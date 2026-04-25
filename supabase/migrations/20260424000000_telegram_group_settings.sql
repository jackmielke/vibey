-- telegram_group_settings: tracks which Telegram group chats Vibey is enabled in.
-- By default, Vibey joins silently and does not respond.
-- An admin in the group sends "/vibey on" to activate it.

CREATE TABLE IF NOT EXISTS public.telegram_group_settings (
  chat_id       BIGINT PRIMARY KEY,
  chat_title    TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT false,
  enabled_at    TIMESTAMPTZ,
  enabled_by    TEXT,
  disabled_at   TIMESTAMPTZ,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  bot_username  TEXT NOT NULL DEFAULT 'vibey_ai_bot'
);

ALTER TABLE public.telegram_group_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to group settings"
  ON public.telegram_group_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
