BEGIN;

CREATE TEMP TABLE jack_profile_merge (
  canonical_id uuid NOT NULL,
  duplicate_id uuid UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO jack_profile_merge (canonical_id, duplicate_id)
VALUES
  ('fcd21afa-5e7f-4a2a-ab66-53ce1e450faf', '6cdf5489-ac9e-45ad-a497-d18717134d2d'),
  ('fcd21afa-5e7f-4a2a-ab66-53ce1e450faf', 'bd250562-224f-44a8-ae12-c90c9f0306c7'),
  ('fcd21afa-5e7f-4a2a-ab66-53ce1e450faf', 'cfa93cc3-b794-450c-ad83-800bd086d7c9'),
  ('fcd21afa-5e7f-4a2a-ab66-53ce1e450faf', 'cf222566-eb11-4a47-baaa-de40300f0b2c'),
  ('fcd21afa-5e7f-4a2a-ab66-53ce1e450faf', '8226c5a4-986c-4902-95d0-4f82226c67ba'),
  ('fcd21afa-5e7f-4a2a-ab66-53ce1e450faf', '46bfcff0-0d8b-4455-b10e-0d91f6182ae8'),
  ('fcd21afa-5e7f-4a2a-ab66-53ce1e450faf', '4b575624-0366-4ca7-a8de-46c932276c5d'),
  ('fcd21afa-5e7f-4a2a-ab66-53ce1e450faf', 'f1bc4480-e9d4-43d8-b216-3ff37fa3011b');

-- Tables with uniqueness on user_id need duplicate target rows removed first.
DELETE FROM public.community_members cm
USING jack_profile_merge m
WHERE cm.user_id = m.duplicate_id
  AND EXISTS (
    SELECT 1 FROM public.community_members existing
    WHERE existing.community_id = cm.community_id
      AND existing.user_id = m.canonical_id
  );

DELETE FROM public.user_roles ur
USING jack_profile_merge m
WHERE ur.user_id = m.duplicate_id
  AND EXISTS (
    SELECT 1 FROM public.user_roles existing
    WHERE existing.role = ur.role
      AND existing.user_id = m.canonical_id
  );

DELETE FROM public.user_preferences up
USING jack_profile_merge m
WHERE up.user_id = m.duplicate_id
  AND EXISTS (SELECT 1 FROM public.user_preferences existing WHERE existing.user_id = m.canonical_id);

DELETE FROM public.user_embeddings ue
USING jack_profile_merge m
WHERE ue.user_id = m.duplicate_id
  AND EXISTS (SELECT 1 FROM public.user_embeddings existing WHERE existing.user_id = m.canonical_id);

DELETE FROM public.user_locations ul
USING jack_profile_merge m
WHERE ul.user_id = m.duplicate_id
  AND EXISTS (SELECT 1 FROM public.user_locations existing WHERE existing.user_id = m.canonical_id);

-- Re-point all known foreign keys that reference public.users.
UPDATE public.agents t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;
UPDATE public.ai_chat_sessions t SET user_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_id = m.duplicate_id;
UPDATE public.bot_templates t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;
UPDATE public.bot_tokens t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;
UPDATE public.characters t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;
UPDATE public.community_members t SET referred_by = m.canonical_id FROM jack_profile_merge m WHERE t.referred_by = m.duplicate_id;
UPDATE public.community_members t SET user_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_id = m.duplicate_id;
UPDATE public.custom_tool_logs t SET user_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_id = m.duplicate_id;
UPDATE public.event_attendees t SET user_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_id = m.duplicate_id;
UPDATE public.events t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;
UPDATE public.gallery_photos t SET uploaded_by = m.canonical_id FROM jack_profile_merge m WHERE t.uploaded_by = m.duplicate_id;
UPDATE public.magic_link_tokens t SET user_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_id = m.duplicate_id;
UPDATE public.memories t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;
UPDATE public.messages t SET sender_id = m.canonical_id FROM jack_profile_merge m WHERE t.sender_id = m.duplicate_id;
UPDATE public.notes t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;
UPDATE public.profile_claim_requests t SET user_profile_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_profile_id = m.duplicate_id;
UPDATE public.projects t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;
UPDATE public.registered_apps t SET owner_user_id = m.canonical_id FROM jack_profile_merge m WHERE t.owner_user_id = m.duplicate_id;
UPDATE public.user_embeddings t SET user_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_id = m.duplicate_id;
UPDATE public.user_locations t SET user_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_id = m.duplicate_id;
UPDATE public.user_preferences t SET user_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_id = m.duplicate_id;
UPDATE public.user_roles t SET user_id = m.canonical_id FROM jack_profile_merge m WHERE t.user_id = m.duplicate_id;
UPDATE public.vibecoin_pickups t SET collected_by = m.canonical_id FROM jack_profile_merge m WHERE t.collected_by = m.duplicate_id;
UPDATE public.world_objects t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;
UPDATE public.x_post_drafts t SET approved_by = m.canonical_id FROM jack_profile_merge m WHERE t.approved_by = m.duplicate_id;
UPDATE public.x_post_drafts t SET created_by = m.canonical_id FROM jack_profile_merge m WHERE t.created_by = m.duplicate_id;

-- Move any user-scoped chat sessions stored as session_key strings.
UPDATE public.agent_chat_logs l
SET session_key = 'user:fcd21afa-5e7f-4a2a-ab66-53ce1e450faf'
FROM jack_profile_merge m
WHERE l.session_key = 'user:' || m.duplicate_id::text;

-- Normalize the canonical profile display.
UPDATE public.users
SET
  name = 'Jack',
  username = 'jack',
  telegram_user_id = 5780091237,
  telegram_username = COALESCE(NULLIF(telegram_username, ''), 'jackmielke'),
  email = COALESCE(NULLIF(email, ''), 'jackcmielke@gmail.com')
WHERE id = 'fcd21afa-5e7f-4a2a-ab66-53ce1e450faf';

DELETE FROM public.users u
USING jack_profile_merge m
WHERE u.id = m.duplicate_id;

COMMIT;
