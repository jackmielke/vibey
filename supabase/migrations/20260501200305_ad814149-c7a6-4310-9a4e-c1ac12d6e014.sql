-- Track every heartbeat execution for history + status panel
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  community_id uuid NOT NULL,
  status text NOT NULL,              -- 'sent' | 'failed' | 'dry_run' | 'running'
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  triggered_by text NOT NULL DEFAULT 'manual',  -- 'manual' | 'schedule'
  dry_run boolean NOT NULL DEFAULT false,
  recipients_count integer DEFAULT 0,
  http_status integer,
  error text,
  result jsonb
);

CREATE INDEX idx_automation_runs_automation_started
  ON public.automation_runs (automation_id, started_at DESC);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- Community admins can read history for their automations
CREATE POLICY "Community admins can view automation runs"
ON public.automation_runs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.automations a
    WHERE a.id = automation_runs.automation_id
      AND public.is_community_admin(a.community_id, auth.uid())
  )
);

-- Edge functions (service role) write rows; no client writes
CREATE POLICY "Service role manages automation runs"
ON public.automation_runs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);