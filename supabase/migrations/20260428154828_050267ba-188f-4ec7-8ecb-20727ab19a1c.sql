-- Automations registry + recipients
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  edge_function text NOT NULL,
  prompt text,
  schedule_cron text,
  schedule_label text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,
  last_run_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, slug)
);

CREATE TABLE public.automation_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'telegram',
  chat_id text NOT NULL,
  label text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, channel, chat_id)
);

CREATE INDEX idx_automation_recipients_automation ON public.automation_recipients(automation_id);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community admins manage automations"
  ON public.automations FOR ALL TO authenticated
  USING (is_community_admin(community_id, auth.uid()))
  WITH CHECK (is_community_admin(community_id, auth.uid()));

CREATE POLICY "Community admins manage automation recipients"
  ON public.automation_recipients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND is_community_admin(a.community_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND is_community_admin(a.community_id, auth.uid())));

CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the daily recap automation for the Vibey community
INSERT INTO public.automations (community_id, slug, name, description, edge_function, prompt, schedule_cron, schedule_label, config)
VALUES (
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'daily-recap',
  'Daily Community Recap',
  'Vibey reads the last 24h of Telegram + chat messages and writes Jack a pre-call brief.',
  'daily-recap',
  'Read all conversations from the last 24 hours. Write a pre-call brief in Vibey''s voice with TL;DR, recurring themes, people worth checking in with, and 2-4 suggested talking points.',
  '30 15 * * *',
  '8:30 AM Pacific (daily)',
  '{"hours": 24}'::jsonb
);

INSERT INTO public.automation_recipients (automation_id, channel, chat_id, label)
SELECT id, 'telegram', '5780091237', 'Jack (DM)' FROM public.automations WHERE slug = 'daily-recap';
