-- Drop 9 vestigial tables: 8 confirmed-empty + project_likes (1 stray row).
-- Cleanup pass so the Vibey build feels like a cleaner slate. If anything
-- external depends on push_subscriptions or community_join_requests (web push
-- or join flow in code that hasn't been exercised yet), we'll know and can
-- restore from migration history.

DROP TABLE IF EXISTS public.project_likes CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.embedding_batch_progress CASCADE;
DROP TABLE IF EXISTS public.outreach_logs CASCADE;
DROP TABLE IF EXISTS public.app_access_tokens CASCADE;
DROP TABLE IF EXISTS public.partner_deliverables CASCADE;
DROP TABLE IF EXISTS public.bot_videos CASCADE;
DROP TABLE IF EXISTS public.community_join_requests CASCADE;
DROP TABLE IF EXISTS public.game_leaderboard CASCADE;
