
ALTER TABLE public.telegram_group_settings
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'read_only'
  CHECK (mode IN ('read_only','reply'));

GRANT SELECT, UPDATE ON public.telegram_group_settings TO authenticated;

DROP POLICY IF EXISTS "Admins can update group settings" ON public.telegram_group_settings;
CREATE POLICY "Admins can update group settings"
  ON public.telegram_group_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
