-- Phase 4.10: Earth-Schatzkammer
-- Earth lädt den community_pool mit 600 Credits Startkapital auf.
-- Schwarm-Artikel-Jobs (Lern-Content auf /erde-lernt) werden ab jetzt aus
-- diesem Pool finanziert — Earth ist der Auftraggeber.
-- Mammut-Jobs (User-Projekte) laufen weiter über das User-Guthaben (10% Steuer).

-- ── Startkapital einbuchen ──────────────────────────────────────────
UPDATE public.community_pool
SET credits_balance = credits_balance + 600,
    total_collected = total_collected + 600,
    updated_at = NOW()
WHERE id = 1;

-- Audit-Eintrag
INSERT INTO public.credit_ledger (user_id, amount, reason, kind)
SELECT id, 600, 'Earth-Startkapital für den Community-Pool', 'bonus'
FROM public.profiles WHERE is_admin = true
LIMIT 1;

-- ── book_article_credits: Schwarm-Artikel-Job aus dem Pool bezahlen ──
-- Earth (= der Pool) ist Auftraggeber. Kein 10%-Steuer-Abzug — Earth
-- besteuert sich nicht selbst. Der Bot bekommt seinen vollen Anteil,
-- der Pool zahlt es. Liefert false wenn der Pool leer ist.
CREATE OR REPLACE FUNCTION public.book_article_credits(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  -- Pool-Guthaben atomisch reduzieren
  UPDATE public.community_pool
  SET credits_balance = credits_balance - p_amount,
      updated_at = NOW()
  WHERE id = 1 AND credits_balance >= p_amount
  RETURNING credits_balance INTO v_balance;

  IF v_balance IS NULL THEN
    RETURN false; -- Pool leer
  END IF;

  -- Bot kriegt seinen Lohn
  UPDATE public.profiles
  SET job_credits = COALESCE(job_credits, 0) + p_amount,
      jobs_done_total = COALESCE(jobs_done_total, 0) + 1
  WHERE id = p_user_id;

  INSERT INTO public.credit_ledger (user_id, amount, reason, kind)
  VALUES (p_user_id, p_amount, 'Schwarm-Artikel-Job (Earth-finanziert)', 'job');

  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.book_article_credits(UUID, NUMERIC) TO service_role;

-- ── pool_can_afford: prüft ob der Pool noch Aufträge vergeben kann ──
CREATE OR REPLACE FUNCTION public.pool_balance()
RETURNS NUMERIC LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(credits_balance, 0) FROM public.community_pool WHERE id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.pool_balance() TO service_role;
