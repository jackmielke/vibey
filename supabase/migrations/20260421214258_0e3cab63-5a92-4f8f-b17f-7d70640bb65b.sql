-- Create dedicated Vibey community + agent, and open RLS so the anon client
-- can read/update just this single agent until auth is added.

-- 1. Create the "Vibey HQ" community (separate from the legacy default community)
INSERT INTO public.communities (id, universal_id, name, description, privacy_level)
VALUES (
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'vibeyhq',
  'Vibey',
  'The home of Vibey, the community AI agent.',
  'private'
);

-- 2. Create the single Vibey agent
INSERT INTO public.agents (
  id,
  community_id,
  name,
  intro_message,
  system_prompt,
  model,
  temperature,
  max_tokens,
  is_active
) VALUES (
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'Vibey',
  'Hey! I''m Vibey 👋',
  'You are Vibey, a warm and witty AI community concierge. You help members feel welcomed, connected, and inspired. Be concise, playful, and genuinely curious about the people you talk to.',
  'google/gemini-2.5-flash',
  0.8,
  2048,
  true
);

-- 3. RLS — allow anon to read & update ONLY this one Vibey agent.
-- (Existing community-scoped policies on `agents` stay in place for the rest.)

CREATE POLICY "Anon can read the Vibey agent"
  ON public.agents
  FOR SELECT
  TO anon, authenticated
  USING (id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e');

CREATE POLICY "Anon can update the Vibey agent"
  ON public.agents
  FOR UPDATE
  TO anon, authenticated
  USING (id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e')
  WITH CHECK (id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e');