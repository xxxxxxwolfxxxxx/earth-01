-- Browser-Unlock funktioniert nicht ohne INSERT-Policy. Bisher konnte nur die
-- telegram-webhook Edge Function (service_role) Skills freischalten. Für
-- konfig-Skills (api_keys, telegram, ...) muss der User aber selbst über das
-- Frontend unlocken können.

CREATE POLICY user_skills_owner_insert
  ON public.user_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
