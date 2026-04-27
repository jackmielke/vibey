
-- 1. Make Jack an admin of the Vibey community
INSERT INTO public.community_members (community_id, user_id, role)
VALUES ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'fcd21afa-5e7f-4a2a-ab66-53ce1e450faf', 'admin')
ON CONFLICT DO NOTHING;

-- 2. MEMORIES: drop anon policies, rely on community admin policies
DROP POLICY IF EXISTS "Anon can read Vibey memories" ON public.memories;
DROP POLICY IF EXISTS "Anon can insert Vibey memories" ON public.memories;
DROP POLICY IF EXISTS "Anon can update Vibey memories" ON public.memories;
DROP POLICY IF EXISTS "Anon can delete Vibey memories" ON public.memories;

CREATE POLICY "Community admins can manage memories"
ON public.memories FOR ALL
TO authenticated
USING (community_id IS NOT NULL AND public.is_community_admin(community_id, auth.uid()))
WITH CHECK (community_id IS NOT NULL AND public.is_community_admin(community_id, auth.uid()));

-- 3. AGENT_CHAT_LOGS: drop anon read
DROP POLICY IF EXISTS "Anon can read Vibey chat logs" ON public.agent_chat_logs;
-- "Community admins can view chat logs" policy already exists, keep it.

-- 4. AGENTS: drop anon update; keep anon SELECT for the public intro message
DROP POLICY IF EXISTS "Anon can update the Vibey agent" ON public.agents;
-- Keep "Anon can read the Vibey agent" so unauthenticated landing pages can still load it.

-- 5. USERS: allow community admins to view + update profiles of members in their community
CREATE POLICY "Community admins can view community member profiles"
ON public.users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.user_id = users.id
      AND public.is_community_admin(cm.community_id, auth.uid())
  )
);

CREATE POLICY "Community admins can update community member profiles"
ON public.users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.user_id = users.id
      AND public.is_community_admin(cm.community_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.user_id = users.id
      AND public.is_community_admin(cm.community_id, auth.uid())
  )
);
