CREATE TABLE public.agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'web',
  required_secrets text[] NOT NULL DEFAULT '{}',
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view tools"
  ON public.agent_tools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage tools"
  ON public.agent_tools FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_agent_tools_updated_at
  BEFORE UPDATE ON public.agent_tools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.agent_tools (name, label, description, category, required_secrets, is_enabled, sort_order) VALUES
  ('save_memory', 'Save Memory', 'Stores a durable fact about the community in long-term memory.', 'memory', ARRAY['SUPABASE_SERVICE_ROLE_KEY'], true, 10),
  ('update_memory', 'Update Memory', 'Edit one of your own memories. Shows before/after inline.', 'memory', ARRAY['SUPABASE_SERVICE_ROLE_KEY'], true, 20),
  ('web_search', 'Web Search', 'Searches the live web via Brave for current info, news, and facts.', 'web', ARRAY['BRAVE_SEARCH_API_KEY'], true, 30),
  ('fetch_url', 'Fetch URL', 'Fetches readable text from a specific web page (up to ~6k chars).', 'web', ARRAY[]::text[], true, 40),
  ('get_vibe_price', 'VIBE Price', 'Live VibeCoin (VIBE on Base) price from GeckoTerminal. Always reports what 1M VIBE is worth.', 'web', ARRAY[]::text[], true, 50),
  ('recall_memories', 'Recall Memories', 'Semantic search over the memory corpus. Coming when corpus outgrows preload.', 'future', ARRAY[]::text[], false, 90),
  ('send_telegram', 'Send Telegram Message', 'Proactively message a person or group on Telegram. Planned.', 'future', ARRAY['TELEGRAM_BOT_TOKEN'], false, 100);