INSERT INTO public.agent_tools (name, label, description, is_enabled)
VALUES (
  'fetch_granola_note',
  'Fetch Granola note',
  'Fetch a single Granola meeting note by URL or note id. Used when someone pastes a notes.granola.ai link.',
  true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  label = EXCLUDED.label;