-- Phase 4.8: Mehrere LLM-Provider gleichzeitig
-- llm_api_key bleibt der "aktive" Key. Zusätzliche Keys liegen in extra_llm_keys
-- als JSONB-Array. Wechsel via swap_active_llm-RPC.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_llm_keys JSONB DEFAULT '[]'::jsonb NOT NULL;

-- ── swap_active_llm: tauscht aktiven Key mit einem aus extra_llm_keys ──
-- Index = Position im extra_llm_keys-Array (0-based)
CREATE OR REPLACE FUNCTION public.swap_active_llm(p_user_id UUID, p_index INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_extras JSONB;
  v_target JSONB;
  v_current JSONB;
BEGIN
  -- Aktuellen Aktiven & Extras laden
  SELECT extra_llm_keys INTO v_extras
  FROM public.profiles WHERE id = p_user_id;
  IF v_extras IS NULL THEN v_extras := '[]'::jsonb; END IF;

  IF p_index < 0 OR p_index >= jsonb_array_length(v_extras) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'index_out_of_range');
  END IF;

  v_target := v_extras -> p_index;

  -- Aktuellen Aktiven als JSONB einsammeln (falls vorhanden)
  SELECT CASE WHEN llm_api_key IS NOT NULL THEN
    jsonb_build_object(
      'key',      llm_api_key,
      'base_url', llm_base_url,
      'model',    llm_model,
      'label',    COALESCE(llm_label, '')
    )
  END
  INTO v_current
  FROM public.profiles WHERE id = p_user_id;

  -- Aktiven mit Target tauschen
  UPDATE public.profiles
  SET llm_api_key  = v_target ->> 'key',
      llm_base_url = v_target ->> 'base_url',
      llm_model    = v_target ->> 'model',
      llm_label    = v_target ->> 'label',
      -- Im Array den alten Aktiven dort speichern, wo das Target stand
      extra_llm_keys = jsonb_set(v_extras, ARRAY[p_index::text],
                                  COALESCE(v_current, '{}'::jsonb))
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Optionales Label-Feld am aktiven Key
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS llm_label TEXT;

GRANT EXECUTE ON FUNCTION public.swap_active_llm(UUID, INT) TO authenticated;
