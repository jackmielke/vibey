INSERT INTO public.telegram_dm_settings (telegram_user_id, telegram_username, enabled, mode, notes)
SELECT DISTINCT telegram_user_id, telegram_username, true, 'reply', 'backfilled from /start'
FROM public.agent_chat_logs
WHERE user_message = '/start' AND telegram_user_id IS NOT NULL
ON CONFLICT (telegram_user_id) DO NOTHING;