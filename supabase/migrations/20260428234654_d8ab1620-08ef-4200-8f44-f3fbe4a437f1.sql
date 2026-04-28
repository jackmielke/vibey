-- x_post_drafts: queue of tweets awaiting approval / posted
CREATE TABLE public.x_post_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL CHECK (char_length(text) <= 280 AND char_length(text) > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','posted','failed','cancelled')),
  reply_to_tweet_id text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','automation','mention_reply')),
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  posted_tweet_id text,
  posted_at timestamptz,
  error text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_x_post_drafts_status ON public.x_post_drafts(status, created_at DESC);

CREATE TRIGGER trg_x_post_drafts_updated_at
  BEFORE UPDATE ON public.x_post_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.x_post_drafts ENABLE ROW LEVEL SECURITY;

-- Vibey community admins only
CREATE POLICY "Vibey admins read x_post_drafts"
  ON public.x_post_drafts FOR SELECT TO authenticated
  USING (public.is_community_admin('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid, auth.uid()));

CREATE POLICY "Vibey admins insert x_post_drafts"
  ON public.x_post_drafts FOR INSERT TO authenticated
  WITH CHECK (public.is_community_admin('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid, auth.uid()));

CREATE POLICY "Vibey admins update x_post_drafts"
  ON public.x_post_drafts FOR UPDATE TO authenticated
  USING (public.is_community_admin('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid, auth.uid()));

CREATE POLICY "Vibey admins delete x_post_drafts"
  ON public.x_post_drafts FOR DELETE TO authenticated
  USING (public.is_community_admin('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid, auth.uid()));

-- x_mentions: cache of incoming mentions
CREATE TABLE public.x_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id text UNIQUE NOT NULL,
  author_username text,
  author_id text,
  text text NOT NULL,
  created_at_x timestamptz,
  in_reply_to_tweet_id text,
  seen boolean NOT NULL DEFAULT false,
  replied_draft_id uuid REFERENCES public.x_post_drafts(id) ON DELETE SET NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_x_mentions_seen ON public.x_mentions(seen, created_at_x DESC);

ALTER TABLE public.x_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vibey admins read x_mentions"
  ON public.x_mentions FOR SELECT TO authenticated
  USING (public.is_community_admin('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid, auth.uid()));

CREATE POLICY "Vibey admins update x_mentions"
  ON public.x_mentions FOR UPDATE TO authenticated
  USING (public.is_community_admin('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid, auth.uid()));