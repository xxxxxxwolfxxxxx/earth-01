-- Phase 4.5: Sauberer Start für einsame Bots
-- Boni-System: Welcome + Skill-Belohnung + Daily-Drip + Referral.
-- Boni sind gedeckelt bei BONUS_CAP=50 Credits (ab dann nur noch echte Job-Credits).

-- ── Neue Spalten in profiles ─────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code      TEXT,
  ADD COLUMN IF NOT EXISTS referred_by        UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS bonus_credits_earned NUMERIC DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_daily_credit_at TIMESTAMPTZ;

-- Referral-Codes müssen eindeutig sein, einmal generiert
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_unique
  ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;

-- ── Hilfsfunktion: Referral-Code generieren ─────────────────────────
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    -- 8-stelliger Code aus Buchstaben + Zahlen (URL-safe, ohne 0/O/1/l zur Verwechslungsfreiheit)
    candidate := array_to_string(ARRAY(
      SELECT substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', floor(random()*30)::int + 1, 1)
      FROM generate_series(1,8)
    ), '');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

-- Allen bestehenden Usern Codes zuweisen
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- Neue User bekommen automatisch Code beim Insert
CREATE OR REPLACE FUNCTION public.profile_assign_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_referral_code ON public.profiles;
CREATE TRIGGER trg_profile_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_assign_referral_code();

-- ── Welcome-Bonus: 5 Credits bei Anmeldung ──────────────────────────
-- Beim handle_new_user-Trigger (existiert in 001_initial_schema) ergänzen wir
-- nicht — stattdessen ein nachgelagerter Trigger der explizit nur Boni vergibt
-- (Cap-Logik bleibt zentral in book_bonus_credits).

CREATE OR REPLACE FUNCTION public.book_bonus_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_earned NUMERIC;
  v_grant  NUMERIC;
  BONUS_CAP CONSTANT NUMERIC := 50;
BEGIN
  -- Wieviel Bonus hat der User schon kassiert?
  SELECT bonus_credits_earned INTO v_earned
  FROM public.profiles WHERE id = p_user_id;
  IF v_earned IS NULL THEN v_earned := 0; END IF;

  -- Nur soviel gewähren wie unter dem Cap noch frei ist
  v_grant := LEAST(p_amount, GREATEST(0, BONUS_CAP - v_earned));
  IF v_grant <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
  SET job_credits = COALESCE(job_credits, 0) + v_grant,
      bonus_credits_earned = COALESCE(bonus_credits_earned, 0) + v_grant
  WHERE id = p_user_id;

  -- Audit-Eintrag (falls Tabelle existiert, sonst still ignorieren)
  BEGIN
    INSERT INTO public.credit_ledger (user_id, amount, reason, kind)
    VALUES (p_user_id, v_grant, p_reason, 'bonus');
  EXCEPTION WHEN undefined_table THEN
    -- Tabelle gibt's noch nicht, kein Drama
    NULL;
  END;

  RETURN v_grant;
END;
$$;

-- ── Credit-Ledger (Audit-Log) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     NUMERIC NOT NULL,
  reason     TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('bonus', 'job', 'spend', 'referral')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON public.credit_ledger(user_id, created_at DESC);
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_ledger_owner_select ON public.credit_ledger;
CREATE POLICY credit_ledger_owner_select ON public.credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS credit_ledger_service_all ON public.credit_ledger;
CREATE POLICY credit_ledger_service_all ON public.credit_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Trigger: 5 Credits Welcome-Bonus für neue Profile ───────────────
CREATE OR REPLACE FUNCTION public.welcome_bonus()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.book_bonus_credits(NEW.id, 5, 'Welcome-Bonus');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_welcome_bonus ON public.profiles;
CREATE TRIGGER trg_welcome_bonus
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.welcome_bonus();

-- Existierende User auch mit 5 Credits versorgen (einmalig, falls noch nichts vergeben)
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT id FROM public.profiles WHERE COALESCE(bonus_credits_earned, 0) = 0
  LOOP
    PERFORM public.book_bonus_credits(p.id, 5, 'Welcome-Bonus (retro)');
  END LOOP;
END $$;

-- ── Trigger: 1 Credit pro freigeschaltetem Skill ────────────────────
CREATE OR REPLACE FUNCTION public.skill_unlock_credit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.book_bonus_credits(NEW.user_id, 1, 'Skill: ' || NEW.skill_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_skill_unlock_credit ON public.user_skills;
CREATE TRIGGER trg_skill_unlock_credit
  AFTER INSERT ON public.user_skills
  FOR EACH ROW EXECUTE FUNCTION public.skill_unlock_credit();

-- ── Daily-Drip: RPC zum Anspruch auf 1 Credit/Tag ───────────────────
CREATE OR REPLACE FUNCTION public.claim_daily_credit(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last TIMESTAMPTZ;
  v_granted NUMERIC;
BEGIN
  SELECT last_daily_credit_at INTO v_last FROM public.profiles WHERE id = p_user_id;
  IF v_last IS NOT NULL AND v_last > NOW() - INTERVAL '20 hours' THEN
    RETURN jsonb_build_object('granted', 0, 'next_at', v_last + INTERVAL '20 hours');
  END IF;

  v_granted := public.book_bonus_credits(p_user_id, 1, 'Daily-Drip');
  UPDATE public.profiles SET last_daily_credit_at = NOW() WHERE id = p_user_id;

  RETURN jsonb_build_object('granted', v_granted, 'next_at', NOW() + INTERVAL '20 hours');
END;
$$;

-- ── Referral-Redemption: bei Setup-Abschluss beide belohnen ─────────
-- Wird vom Frontend aufgerufen sobald Telegram+LLM-Setup steht.
CREATE OR REPLACE FUNCTION public.redeem_referral(p_user_id UUID, p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_referrer UUID;
  v_already  UUID;
  v_count    INT;
  REFERRAL_REWARD CONSTANT NUMERIC := 5;
  MAX_REFERRALS  CONSTANT INT      := 10;
BEGIN
  -- Schon eingelöst?
  SELECT referred_by INTO v_already FROM public.profiles WHERE id = p_user_id;
  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  END IF;

  -- Code gültig?
  SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = p_code;
  IF v_referrer IS NULL OR v_referrer = p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- Referrer noch unter dem Max-Limit?
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE referred_by = v_referrer;
  IF v_count >= MAX_REFERRALS THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'referrer_maxed');
  END IF;

  -- Beide gutschreiben + Beziehung speichern
  UPDATE public.profiles SET referred_by = v_referrer WHERE id = p_user_id;
  PERFORM public.book_bonus_credits(p_user_id,  REFERRAL_REWARD, 'Referral: angemeldet von ' || p_code);
  PERFORM public.book_bonus_credits(v_referrer, REFERRAL_REWARD, 'Referral: ' || p_user_id::text);

  RETURN jsonb_build_object('ok', true, 'granted', REFERRAL_REWARD);
END;
$$;

-- Berechtigungen für die RPCs
GRANT EXECUTE ON FUNCTION public.claim_daily_credit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral(UUID, TEXT) TO authenticated;
