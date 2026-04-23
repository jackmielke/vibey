-- Add a surface-agnostic session key so we can thread conversations per
-- (surface, external_id). Eddie-era rows have telegram_chat_id set; backfill
-- those as telegram:<chat_id>. Older rows with no telegram metadata get
-- legacy:unknown. Future inserts from chat-with-vibey set session_key directly.

ALTER TABLE public.agent_chat_logs
  ADD COLUMN IF NOT EXISTS session_key TEXT;

UPDATE public.agent_chat_logs
SET session_key = CASE
  WHEN telegram_chat_id IS NOT NULL THEN 'telegram:' || telegram_chat_id::text
  ELSE 'legacy:unknown'
END
WHERE session_key IS NULL;

-- Fast lookups for "last N messages for this session with this agent".
CREATE INDEX IF NOT EXISTS agent_chat_logs_agent_session_created_idx
  ON public.agent_chat_logs (agent_id, session_key, created_at DESC);

COMMENT ON COLUMN public.agent_chat_logs.session_key IS
  'Surface-agnostic conversation key, format: <surface>:<external_id> (e.g. telegram:12345, web:anon).';
