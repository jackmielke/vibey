-- Public read for Vibey community memories (matches existing pattern for agents + chat logs)
CREATE POLICY "Anon can read Vibey memories"
ON public.memories FOR SELECT
TO anon, authenticated
USING (community_id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid);

CREATE POLICY "Anon can insert Vibey memories"
ON public.memories FOR INSERT
TO anon, authenticated
WITH CHECK (community_id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid);

CREATE POLICY "Anon can delete Vibey memories"
ON public.memories FOR DELETE
TO anon, authenticated
USING (community_id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid);

CREATE POLICY "Anon can update Vibey memories"
ON public.memories FOR UPDATE
TO anon, authenticated
USING (community_id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid)
WITH CHECK (community_id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid);