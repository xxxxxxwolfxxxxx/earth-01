-- Phase 4.6: Dynamisches Mammut-Pricing
-- Statt fester 50-Credit-Schwelle: pro Projekt ein LLM-generierter Plan
-- mit individueller Job-Anzahl. Bezahlt wird Job-für-Job (1 Credit = 1 Job).
-- Geht das Guthaben aus: Task pausiert, Resume sobald wieder Credits da sind.

-- ── mammoth_tasks erweitern ─────────────────────────────────────────
ALTER TABLE public.mammoth_tasks
  ADD COLUMN IF NOT EXISTS brief_prompt   TEXT,
  ADD COLUMN IF NOT EXISTS job_plan       JSONB,
  ADD COLUMN IF NOT EXISTS cost_total     INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS cost_paid      INT DEFAULT 0 NOT NULL;

-- Erlaube neue Status-Werte für Pause/Planning
DO $$
DECLARE
  has_check BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'mammoth_tasks' AND constraint_name LIKE '%status%'
  ) INTO has_check;
  IF has_check THEN
    BEGIN
      ALTER TABLE public.mammoth_tasks DROP CONSTRAINT IF EXISTS mammoth_tasks_status_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

ALTER TABLE public.mammoth_tasks
  ADD CONSTRAINT mammoth_tasks_status_check
  CHECK (status IN ('planning', 'pending', 'in_progress', 'paused_low_credits', 'completed', 'failed', 'cancelled'));

-- ── RPC: pay_for_mammoth_job — wird vom Orchestrator vor jedem Job-Assign gerufen
-- Liefert true wenn 1 Credit erfolgreich abgebucht wurde und der Job laufen darf.
-- Bei leerem Guthaben: pausiert den Task und gibt false zurück.
CREATE OR REPLACE FUNCTION public.pay_for_mammoth_job(p_task_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID;
  v_credits NUMERIC;
  v_status TEXT;
BEGIN
  SELECT user_id, status INTO v_user, v_status
  FROM public.mammoth_tasks WHERE id = p_task_id;

  IF v_user IS NULL THEN RETURN false; END IF;
  IF v_status NOT IN ('pending', 'in_progress', 'paused_low_credits') THEN RETURN false; END IF;

  -- Guthaben atomisch reduzieren
  UPDATE public.profiles
  SET job_credits = job_credits - 1
  WHERE id = v_user AND COALESCE(job_credits, 0) >= 1
  RETURNING job_credits INTO v_credits;

  IF v_credits IS NULL THEN
    -- Kein Guthaben → Task pausieren
    UPDATE public.mammoth_tasks
    SET status = 'paused_low_credits', updated_at = NOW()
    WHERE id = p_task_id AND status <> 'paused_low_credits';
    RETURN false;
  END IF;

  -- Erfolgreich gezahlt → Task ggf. aus Pause holen
  UPDATE public.mammoth_tasks
  SET cost_paid = cost_paid + 1,
      status = CASE WHEN status = 'paused_low_credits' OR status = 'pending' THEN 'in_progress' ELSE status END,
      updated_at = NOW()
  WHERE id = p_task_id;

  -- Audit
  INSERT INTO public.credit_ledger (user_id, amount, reason, kind)
  VALUES (v_user, -1, 'Mammut-Job ' || p_task_id::text, 'spend');

  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pay_for_mammoth_job(UUID) TO service_role;

-- ── RPC: resume_paused_mammoths — vom Orchestrator regelmäßig gerufen.
-- Setzt pausierte Tasks zurück auf 'pending' wenn der Owner wieder Credits hat.
CREATE OR REPLACE FUNCTION public.resume_paused_mammoths()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE public.mammoth_tasks t
  SET status = 'pending', updated_at = NOW()
  FROM public.profiles p
  WHERE t.user_id = p.id
    AND t.status = 'paused_low_credits'
    AND COALESCE(p.job_credits, 0) >= 1;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resume_paused_mammoths() TO service_role;
