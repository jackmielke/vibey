
-- Heartbeats: scheduled, agent-driven check-ins from Vibey.

CREATE TABLE public.heartbeat_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES public.automations(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('morning','evening')),
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_chat_id TEXT,
  recipient_label TEXT,
  system_prompt TEXT,
  seed_prompt TEXT,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  intermediate_thoughts JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_message TEXT,
  model TEXT,
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  tokens_total INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running',
  delivery_status TEXT,
  error TEXT,
  dry_run BOOLEAN NOT NULL DEFAULT false,
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_heartbeat_runs_created_at ON public.heartbeat_runs(created_at DESC);
CREATE INDEX idx_heartbeat_runs_kind ON public.heartbeat_runs(kind, created_at DESC);
CREATE INDEX idx_heartbeat_runs_automation ON public.heartbeat_runs(automation_id, created_at DESC);

ALTER TABLE public.heartbeat_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all heartbeat runs"
  ON public.heartbeat_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own heartbeat runs"
  ON public.heartbeat_runs FOR SELECT
  USING (
    recipient_user_id IS NOT NULL AND
    recipient_user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- Subscriptions: per-user opt-in for each heartbeat kind.
CREATE TABLE public.heartbeat_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('morning','evening')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  telegram_chat_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

CREATE INDEX idx_heartbeat_subs_kind_enabled ON public.heartbeat_subscriptions(kind) WHERE enabled = true;

ALTER TABLE public.heartbeat_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all subscriptions"
  ON public.heartbeat_subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own subscriptions"
  ON public.heartbeat_subscriptions FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users insert own subscriptions"
  ON public.heartbeat_subscriptions FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users update own subscriptions"
  ON public.heartbeat_subscriptions FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_heartbeat_subs_updated
  BEFORE UPDATE ON public.heartbeat_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed two automation rows (morning + evening) targeting the new function.
INSERT INTO public.automations (community_id, slug, name, description, edge_function, prompt, schedule_cron, schedule_label, enabled, config)
SELECT
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid,
  'morning-heartbeat',
  'Morning Heartbeat',
  'Vibey''s 6am Pacific brief — what''s coming today, who to check on, what to bring to the call.',
  'scheduled-heartbeat',
  'it''s 6am pacific. write jack his morning brief — what''s coming up today, who he should check in with, anything worth bringing to the daily community call. use your tools to actually look things up (granola notes, events, recent chats, memories). text him like you''d text a friend — no headers, no bullet structure unless it reads natural. keep it under ~250 words.',
  '0 13 * * *',
  'Daily · 6:00 AM Pacific',
  true,
  '{"kind":"morning"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.automations WHERE slug = 'morning-heartbeat');

INSERT INTO public.automations (community_id, slug, name, description, edge_function, prompt, schedule_cron, schedule_label, enabled, config)
SELECT
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid,
  'evening-heartbeat',
  'Evening Heartbeat',
  'Vibey''s 9pm Pacific reflection — what happened today, who showed up, what''s worth remembering, anything to follow up on tomorrow.',
  'scheduled-heartbeat',
  'it''s 9pm pacific. text jack a reflection on the day — what happened, who showed up, anything funny or notable, what''s worth remembering, anything to follow up on tomorrow. use your tools to look things up (granola, events, recent chats). text him like a friend — no headers, no rigid structure. keep it under ~250 words.',
  '0 4 * * *',
  'Daily · 9:00 PM Pacific',
  true,
  '{"kind":"evening"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.automations WHERE slug = 'evening-heartbeat');

-- Seed subscriptions for jack (the existing daily-recap recipient).
INSERT INTO public.heartbeat_subscriptions (user_id, kind, enabled, telegram_chat_id)
SELECT u.id, k.kind, true, u.telegram_user_id::text
FROM public.users u
CROSS JOIN (VALUES ('morning'), ('evening')) AS k(kind)
WHERE u.telegram_user_id = 5780091237
ON CONFLICT (user_id, kind) DO NOTHING;
