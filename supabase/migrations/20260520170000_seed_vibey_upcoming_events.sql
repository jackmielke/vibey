with seed (
  community_id,
  created_by,
  title,
  description,
  event_start_time,
  event_end_time,
  event_location,
  event_type,
  hosted_by,
  tags,
  metadata
) as (
  values
    (
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid,
      'fcd21afa-5e7f-4a2a-ab66-53ce1e450faf'::uuid,
      'Friday vibe and build',
      'A virtual call in the vibe of the Telegram group chat.',
      '2026-05-22 10:00:00-07'::timestamptz,
      '2026-05-22 11:00:00-07'::timestamptz,
      'Virtual / Telegram group chat',
      'virtual',
      'Vibey',
      array['vibey', 'build', 'community'],
      '{"source":"seed","series":"vibe-and-build"}'::jsonb
    ),
    (
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid,
      'fcd21afa-5e7f-4a2a-ab66-53ce1e450faf'::uuid,
      'What''s possible with AI?',
      'AI transformation 101 + local case studies.',
      '2026-05-27 08:30:00-07'::timestamptz,
      '2026-05-27 09:30:00-07'::timestamptz,
      'Virtual',
      'virtual',
      'Vibey',
      array['ai', 'virtual', 'community'],
      '{"source":"seed","series":"ai-transformation"}'::jsonb
    ),
    (
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid,
      'fcd21afa-5e7f-4a2a-ab66-53ce1e450faf'::uuid,
      'Set up your AI workspace',
      'Get familiar with Lovable, Claude, Notion, and Granola for real business intelligence.',
      '2026-06-03 08:30:00-07'::timestamptz,
      '2026-06-03 09:30:00-07'::timestamptz,
      'Virtual',
      'virtual',
      'Vibey',
      array['ai', 'workspace', 'workshop'],
      '{"source":"seed","series":"ai-transformation"}'::jsonb
    ),
    (
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid,
      'fcd21afa-5e7f-4a2a-ab66-53ce1e450faf'::uuid,
      'Automate the manual stuff',
      'Pick a few annoying tasks and put AI to work on them.',
      '2026-06-10 08:30:00-07'::timestamptz,
      '2026-06-10 09:30:00-07'::timestamptz,
      'Virtual',
      'virtual',
      'Vibey',
      array['ai', 'automation', 'workshop'],
      '{"source":"seed","series":"ai-transformation"}'::jsonb
    ),
    (
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid,
      'fcd21afa-5e7f-4a2a-ab66-53ce1e450faf'::uuid,
      'Integrate your tools, build the culture',
      'Connect AI across your stack and make the rollout a positive experience for your team.',
      '2026-06-17 08:30:00-07'::timestamptz,
      '2026-06-17 09:30:00-07'::timestamptz,
      'Virtual',
      'virtual',
      'Vibey',
      array['ai', 'integrations', 'culture'],
      '{"source":"seed","series":"ai-transformation"}'::jsonb
    ),
    (
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid,
      'fcd21afa-5e7f-4a2a-ab66-53ce1e450faf'::uuid,
      'Live demos & success stories',
      'Inside a catering OS and a construction OS - plus what to build next.',
      '2026-06-24 08:30:00-07'::timestamptz,
      '2026-06-24 09:30:00-07'::timestamptz,
      'Virtual',
      'virtual',
      'Vibey',
      array['ai', 'demos', 'workshop'],
      '{"source":"seed","series":"ai-transformation"}'::jsonb
    )
)
insert into public.events (
  community_id,
  created_by,
  title,
  description,
  event_start_time,
  event_end_time,
  event_location,
  event_status,
  event_type,
  hosted_by,
  is_public,
  registration_required,
  tags,
  metadata
)
select
  community_id,
  created_by,
  title,
  description,
  event_start_time,
  event_end_time,
  event_location,
  'published',
  event_type,
  hosted_by,
  true,
  false,
  tags,
  metadata
from seed s
where not exists (
  select 1
  from public.events e
  where e.community_id = s.community_id
    and e.title = s.title
    and e.event_start_time = s.event_start_time
);
