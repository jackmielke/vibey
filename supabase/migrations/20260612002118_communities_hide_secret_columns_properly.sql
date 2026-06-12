-- A table-level GRANT SELECT makes a column-level REVOKE a no-op, so the
-- earlier REVOKE of telegram_bot_token/webhook_api_key (in
-- 20260612001549) did not actually hide them. The columns are empty today,
-- but a future token write would leak via the communities USING(true) public
-- SELECT. Fix it correctly: revoke table SELECT from client roles, then
-- re-grant SELECT on only the non-secret columns. service_role keeps its own
-- full grant (edge functions unaffected). The app only ever selects
-- communities.id (verified), so no client breaks.
--
-- Verified after apply: anon SELECT of telegram_bot_token/webhook_api_key →
-- "permission denied for table communities" (42501); anon SELECT of id,name →
-- still works.
REVOKE SELECT ON public.communities FROM anon, authenticated;
GRANT SELECT (
  id, name, description, created_by, created_at, updated_at, invite_code,
  privacy_level, agent_name, agent_instructions, agent_avatar_url,
  agent_intro_message, agent_suggested_messages, experiences, cover_image_url,
  universal_id, telegram_bot_url, agent_model, agent_max_tokens,
  agent_temperature, total_tokens_used, total_cost_usd, last_activity_at,
  support_email, game_design_sky_color, game_design_gravity_y,
  game_design_time_scale, webhook_enabled, webhook_request_count,
  webhook_last_used_at, elevenlabs_agent_id, daily_message_enabled,
  daily_message_content, daily_message_time, timezone
) ON public.communities TO anon, authenticated;
