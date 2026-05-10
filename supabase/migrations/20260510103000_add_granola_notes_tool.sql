INSERT INTO public.agent_tools (
  name,
  label,
  description,
  category,
  required_secrets,
  is_enabled,
  sort_order
)
VALUES (
  'granola_notes',
  'Granola Notes',
  'Searches meeting notes shared with Vibey via the vibey@vibeventures.studio Granola account.',
  'web',
  ARRAY['LOVABLE_API_KEY', 'GRANOLA_API_KEY'],
  true,
  60
)
ON CONFLICT (name) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  required_secrets = EXCLUDED.required_secrets,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
