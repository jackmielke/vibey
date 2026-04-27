CREATE TABLE public.daily_recaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  brief text NOT NULL,
  source_message_count integer NOT NULL DEFAULT 0,
  delivered_to text,
  delivery_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_recaps_community_created ON public.daily_recaps (community_id, created_at DESC);

ALTER TABLE public.daily_recaps ENABLE ROW LEVEL SECURITY;

-- Only community admins can read recaps. Writes happen via service role from the edge function.
CREATE POLICY "Community admins can view recaps"
ON public.daily_recaps
FOR SELECT
TO authenticated
USING (public.is_community_admin(community_id, auth.uid()));