-- Phase 4.9: Auto-Failover zwischen LLM-Providern
-- Wenn der aktive Key sein Tages-Cap erreicht hat und Reserve-Keys verfügbar
-- sind, rotiert die DB automatisch zum nächsten Provider.
--
-- Pro Reserve-Key wird jetzt zusätzlich gespeichert:
--   { key, base_url, model, label, used_today, used_reset, max_jobs }
-- (used_today und max_jobs sind optional, Default 0 bzw. 10)

CREATE OR REPLACE FUNCTION public.auto_rotate_llm(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today      DATE := CURRENT_DATE;
  v_used       INT;
  v_cap        INT;
  v_extras     JSONB;
  v_active     JSONB;
  v_picked_idx INT := -1;
  v_picked     JSONB;
  v_used_reset DATE;
  v_extra      JSONB;
  v_extra_used INT;
  v_extra_cap  INT;
  v_extra_reset DATE;
BEGIN
  SELECT swarm_jobs_today, swarm_jobs_reset_at, max_jobs_per_day, extra_llm_keys,
         CASE WHEN llm_api_key IS NOT NULL THEN
           jsonb_build_object(
             'key', llm_api_key, 'base_url', llm_base_url,
             'model', llm_model, 'label', COALESCE(llm_label, '')
           )
         END
  INTO v_used, v_used_reset, v_cap, v_extras, v_active
  FROM public.profiles WHERE id = p_user_id;

  -- Tages-Reset (falls neue Datum)
  IF v_used_reset IS NULL OR v_used_reset::date <> v_today THEN
    UPDATE public.profiles
    SET swarm_jobs_today = 0, swarm_jobs_reset_at = v_today::text
    WHERE id = p_user_id;
    v_used := 0;
  END IF;

  IF v_extras IS NULL THEN v_extras := '[]'::jsonb; END IF;
  IF v_cap IS NULL THEN v_cap := 10; END IF;

  -- Aktiver Key noch unter seinem Cap? Dann nichts tun.
  IF v_used < v_cap OR jsonb_array_length(v_extras) = 0 THEN
    RETURN jsonb_build_object('rotated', false, 'used', v_used, 'cap', v_cap);
  END IF;

  -- Aktiver ist erschöpft → freien Reserve-Key suchen
  FOR i IN 0..jsonb_array_length(v_extras) - 1 LOOP
    v_extra := v_extras -> i;
    v_extra_used := COALESCE((v_extra ->> 'used_today')::int, 0);
    v_extra_cap  := COALESCE((v_extra ->> 'max_jobs')::int, 10);
    v_extra_reset := COALESCE((v_extra ->> 'used_reset')::date, NULL);
    -- Tages-Reset für Reserve
    IF v_extra_reset IS NULL OR v_extra_reset <> v_today THEN
      v_extra_used := 0;
      v_extras := jsonb_set(v_extras, ARRAY[i::text, 'used_today'], to_jsonb(0));
      v_extras := jsonb_set(v_extras, ARRAY[i::text, 'used_reset'], to_jsonb(v_today::text));
    END IF;
    IF v_extra_used < v_extra_cap THEN
      v_picked_idx := i;
      v_picked := v_extras -> i;
      EXIT;
    END IF;
  END LOOP;

  IF v_picked_idx < 0 THEN
    RETURN jsonb_build_object('rotated', false, 'reason', 'all_exhausted', 'used', v_used, 'cap', v_cap);
  END IF;

  -- Den alten Aktiven mit aktuellem swarm_jobs_today in den Slot des Picked schreiben.
  -- Den Picked als neuen Aktiven setzen, swarm_jobs_today auf dessen used_today.
  v_extras := jsonb_set(v_extras, ARRAY[v_picked_idx::text],
    COALESCE(v_active, '{}'::jsonb)
      || jsonb_build_object('used_today', v_used, 'used_reset', v_today::text)
  );

  UPDATE public.profiles
  SET llm_api_key  = v_picked ->> 'key',
      llm_base_url = v_picked ->> 'base_url',
      llm_model    = v_picked ->> 'model',
      llm_label    = v_picked ->> 'label',
      swarm_jobs_today    = COALESCE((v_picked ->> 'used_today')::int, 0),
      swarm_jobs_reset_at = v_today::text,
      extra_llm_keys      = v_extras
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'rotated', true,
    'new_active', v_picked ->> 'key',
    'new_label',  v_picked ->> 'label',
    'fresh_used', COALESCE((v_picked ->> 'used_today')::int, 0)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_rotate_llm(UUID) TO service_role;
