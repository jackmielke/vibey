CREATE POLICY "Anon can read Vibey chat logs"
ON public.agent_chat_logs
FOR SELECT
TO anon, authenticated
USING (community_id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid);

CREATE POLICY "Anon can read Vibey telegram group settings"
ON public.telegram_group_settings
FOR SELECT
TO anon, authenticated
USING (true);