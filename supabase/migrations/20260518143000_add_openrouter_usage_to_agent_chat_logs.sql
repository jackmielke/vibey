ALTER TABLE public.agent_chat_logs
  ADD COLUMN IF NOT EXISTS prompt_tokens integer,
  ADD COLUMN IF NOT EXISTS completion_tokens integer,
  ADD COLUMN IF NOT EXISTS total_tokens integer,
  ADD COLUMN IF NOT EXISTS cost_credits numeric,
  ADD COLUMN IF NOT EXISTS openrouter_model text,
  ADD COLUMN IF NOT EXISTS usage_json jsonb;

UPDATE public.agent_chat_logs
SET total_tokens = COALESCE(total_tokens, tokens_used)
WHERE tokens_used IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_chat_logs_created_usage_idx
  ON public.agent_chat_logs (created_at DESC)
  WHERE total_tokens IS NOT NULL OR cost_credits IS NOT NULL;
