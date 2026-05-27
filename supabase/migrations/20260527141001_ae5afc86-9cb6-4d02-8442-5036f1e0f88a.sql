-- Per-DM permission overrides for Vibey (mirrors telegram_group_settings)
CREATE TABLE public.telegram_dm_settings (
  telegram_user_id BIGINT PRIMARY KEY,
  telegram_username TEXT,
  display_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  mode TEXT NOT NULL DEFAULT 'reply' CHECK (mode IN ('read_only', 'reply')),
  enabled_at TIMESTAMPTZ,
  enabled_by TEXT,
  disabled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_dm_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_dm_settings TO authenticated;
GRANT ALL ON public.telegram_dm_settings TO service_role;

ALTER TABLE public.telegram_dm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dm settings"
  ON public.telegram_dm_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert dm settings"
  ON public.telegram_dm_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update dm settings"
  ON public.telegram_dm_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete dm settings"
  ON public.telegram_dm_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_telegram_dm_settings_updated_at
  BEFORE UPDATE ON public.telegram_dm_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();