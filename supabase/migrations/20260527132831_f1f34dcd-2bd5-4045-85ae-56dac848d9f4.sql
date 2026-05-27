UPDATE public.telegram_group_settings
SET enabled = false,
    disabled_at = now()
WHERE enabled IS DISTINCT FROM false;