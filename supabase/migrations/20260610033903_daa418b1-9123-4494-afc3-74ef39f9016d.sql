
UPDATE public.agent_tools SET is_enabled = false WHERE name = 'fetch_granola_note';

INSERT INTO public.agent_tools (name, label, description, category, required_secrets, is_enabled, sort_order)
VALUES
  ('granola_notes', 'Granola Notes', 'List Granola meeting notes', 'web', ARRAY['GRANOLA_API_KEY'], false, 100),
  ('list_edge_events', 'List Edge Events', 'List upcoming EdgeOS events', 'web', ARRAY['EDGEOS_API_TOKEN'], false, 101),
  ('get_edge_event', 'Get Edge Event', 'Fetch a single EdgeOS event', 'web', ARRAY['EDGEOS_API_TOKEN'], false, 102),
  ('rsvp_edge_event', 'RSVP Edge Event', 'RSVP to an EdgeOS event', 'web', ARRAY['EDGEOS_API_TOKEN'], false, 103)
ON CONFLICT (name) DO UPDATE SET is_enabled = false;
