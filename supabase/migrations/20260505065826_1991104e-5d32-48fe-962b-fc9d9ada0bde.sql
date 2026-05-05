
-- Allow signed-in users to read chat logs that belong to their unified session key
CREATE POLICY "Users can view their own chat logs by session key"
ON public.agent_chat_logs
FOR SELECT
TO authenticated
USING (
  session_key IS NOT NULL
  AND session_key = 'user:' || (
    SELECT u.id::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1
  )
);

-- Helpful index for session-key lookups
CREATE INDEX IF NOT EXISTS agent_chat_logs_session_key_created_idx
  ON public.agent_chat_logs (session_key, created_at DESC);
