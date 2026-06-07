
-- =========================================================
-- 1. Preview function — read-only
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_preview_telegram_username_duplicate_groups()
RETURNS TABLE(tg_username text, n int, rows jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT LOWER(u.telegram_username) AS tg_username,
         COUNT(*)::int AS n,
         jsonb_agg(to_jsonb(u) ORDER BY u.created_at) AS rows
  FROM public.users u
  WHERE u.telegram_username IS NOT NULL AND u.telegram_username <> ''
  GROUP BY LOWER(u.telegram_username)
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC, LOWER(u.telegram_username);
END;
$$;

-- =========================================================
-- 2. Pair merge — coalesce fields, repoint FKs, delete loser
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_merge_user_pair(primary_id uuid, loser_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.users%ROWTYPE;
  l public.users%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF primary_id = loser_id THEN RETURN; END IF;

  SELECT * INTO p FROM public.users WHERE id = primary_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'primary % not found', primary_id; END IF;
  SELECT * INTO l FROM public.users WHERE id = loser_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'loser % not found', loser_id; END IF;

  -- Field-level coalesce into primary (keep primary unless it's empty/null/false)
  UPDATE public.users SET
    name                    = COALESCE(NULLIF(p.name,''), l.name),
    username                = COALESCE(NULLIF(p.username,''), l.username),
    email                   = COALESCE(NULLIF(p.email,''), l.email),
    auth_user_id            = COALESCE(p.auth_user_id, l.auth_user_id),
    telegram_user_id        = COALESCE(p.telegram_user_id, l.telegram_user_id),
    telegram_username       = COALESCE(NULLIF(p.telegram_username,''), l.telegram_username),
    telegram_photo_url      = COALESCE(NULLIF(p.telegram_photo_url,''), l.telegram_photo_url),
    avatar_url              = COALESCE(NULLIF(p.avatar_url,''), l.avatar_url),
    profile_picture_url     = COALESCE(NULLIF(p.profile_picture_url,''), l.profile_picture_url),
    bio                     = COALESCE(NULLIF(p.bio,''), l.bio),
    headline                = COALESCE(NULLIF(p.headline,''), l.headline),
    intentions              = COALESCE(NULLIF(p.intentions,''), l.intentions),
    instagram_handle        = COALESCE(NULLIF(p.instagram_handle,''), l.instagram_handle),
    twitter_handle          = COALESCE(NULLIF(p.twitter_handle,''), l.twitter_handle),
    phone_number            = COALESCE(NULLIF(p.phone_number,''), l.phone_number),
    phone_verified          = COALESCE(p.phone_verified,false) OR COALESCE(l.phone_verified,false),
    world_id_verified       = COALESCE(p.world_id_verified,false) OR COALESCE(l.world_id_verified,false),
    world_id_verified_at    = COALESCE(p.world_id_verified_at, l.world_id_verified_at),
    world_id_nullifier_hash = COALESCE(NULLIF(p.world_id_nullifier_hash,''), l.world_id_nullifier_hash),
    is_claimed              = COALESCE(p.is_claimed,false) OR COALESCE(l.is_claimed,false),
    is_vibe_resident        = COALESCE(p.is_vibe_resident,false) OR COALESCE(l.is_vibe_resident,false),
    vibe_resident_at        = COALESCE(p.vibe_resident_at, l.vibe_resident_at),
    wallet_address          = COALESCE(NULLIF(p.wallet_address,''), l.wallet_address),
    wallet_provider         = COALESCE(NULLIF(p.wallet_provider,''), l.wallet_provider),
    wallet_connected_at     = COALESCE(p.wallet_connected_at, l.wallet_connected_at),
    source_url              = COALESCE(NULLIF(p.source_url,''), l.source_url),
    original_item_id        = COALESCE(p.original_item_id, l.original_item_id),
    interests_skills        = (
      SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE array_agg(DISTINCT x) END
      FROM unnest(
        COALESCE(p.interests_skills, ARRAY[]::text[]) || COALESCE(l.interests_skills, ARRAY[]::text[])
      ) AS x
      WHERE x IS NOT NULL AND x <> ''
    ),
    vibecoin_balance        = COALESCE(p.vibecoin_balance,0) + COALESCE(l.vibecoin_balance,0),
    updated_at              = now()
  WHERE id = primary_id;

  -- Repoint FKs. For tables with composite unique constraints, drop loser-side
  -- conflicts first so the UPDATE doesn't fail.

  -- community_members (UNIQUE community_id, user_id)
  DELETE FROM public.community_members cm
   WHERE cm.user_id = loser_id
     AND EXISTS (SELECT 1 FROM public.community_members cm2
                 WHERE cm2.user_id = primary_id AND cm2.community_id = cm.community_id);
  UPDATE public.community_members SET user_id = primary_id WHERE user_id = loser_id;
  UPDATE public.community_members SET referred_by = primary_id WHERE referred_by = loser_id;

  -- user_roles (UNIQUE user_id, role)
  DELETE FROM public.user_roles ur
   WHERE ur.user_id = loser_id
     AND EXISTS (SELECT 1 FROM public.user_roles ur2
                 WHERE ur2.user_id = primary_id AND ur2.role = ur.role);
  UPDATE public.user_roles SET user_id = primary_id WHERE user_id = loser_id;

  -- user_embeddings (PK or unique on user_id)
  DELETE FROM public.user_embeddings
   WHERE user_id = loser_id
     AND EXISTS (SELECT 1 FROM public.user_embeddings WHERE user_id = primary_id);
  UPDATE public.user_embeddings SET user_id = primary_id WHERE user_id = loser_id;

  -- user_preferences (likely unique on user_id)
  DELETE FROM public.user_preferences
   WHERE user_id = loser_id
     AND EXISTS (SELECT 1 FROM public.user_preferences WHERE user_id = primary_id);
  UPDATE public.user_preferences SET user_id = primary_id WHERE user_id = loser_id;

  -- event_attendees (likely UNIQUE event_id, user_id)
  DELETE FROM public.event_attendees ea
   WHERE ea.user_id = loser_id
     AND EXISTS (SELECT 1 FROM public.event_attendees ea2
                 WHERE ea2.user_id = primary_id AND ea2.event_id = ea.event_id);
  UPDATE public.event_attendees SET user_id = primary_id WHERE user_id = loser_id;

  -- heartbeat_subscriptions (one per user typically)
  DELETE FROM public.heartbeat_subscriptions hs
   WHERE hs.user_id = loser_id
     AND EXISTS (SELECT 1 FROM public.heartbeat_subscriptions hs2 WHERE hs2.user_id = primary_id);
  UPDATE public.heartbeat_subscriptions SET user_id = primary_id WHERE user_id = loser_id;

  -- Straightforward repoints (no expected unique conflicts)
  UPDATE public.memories               SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.messages               SET sender_id       = primary_id WHERE sender_id       = loser_id;
  UPDATE public.events                 SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.ai_chat_sessions       SET user_id         = primary_id WHERE user_id         = loser_id;
  UPDATE public.characters             SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.world_objects          SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.vibecoin_pickups       SET collected_by    = primary_id WHERE collected_by    = loser_id;
  UPDATE public.projects               SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.profile_claim_requests SET user_profile_id = primary_id WHERE user_profile_id = loser_id;
  UPDATE public.custom_tool_logs       SET user_id         = primary_id WHERE user_id         = loser_id;
  UPDATE public.bot_tokens             SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.bot_templates          SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.magic_link_tokens      SET user_id         = primary_id WHERE user_id         = loser_id;
  UPDATE public.notes                  SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.gallery_photos         SET uploaded_by     = primary_id WHERE uploaded_by     = loser_id;
  UPDATE public.registered_apps        SET owner_user_id   = primary_id WHERE owner_user_id   = loser_id;
  UPDATE public.agents                 SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.x_post_drafts          SET approved_by     = primary_id WHERE approved_by     = loser_id;
  UPDATE public.x_post_drafts          SET created_by      = primary_id WHERE created_by      = loser_id;
  UPDATE public.user_locations         SET user_id         = primary_id WHERE user_id         = loser_id;
  UPDATE public.heartbeat_runs         SET recipient_user_id = primary_id WHERE recipient_user_id = loser_id;

  -- Finally delete the loser row
  DELETE FROM public.users WHERE id = loser_id;
END;
$$;

-- =========================================================
-- 3. Bulk auto-merge orchestrator
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_auto_merge_telegram_username_duplicates(dry_run boolean DEFAULT true)
RETURNS TABLE(tg_username text, primary_id uuid, merged_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grp record;
  winner_id uuid;
  loser_row record;
  cnt int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  FOR grp IN
    SELECT LOWER(u.telegram_username) AS tg
    FROM public.users u
    WHERE u.telegram_username IS NOT NULL AND u.telegram_username <> ''
    GROUP BY LOWER(u.telegram_username)
    HAVING COUNT(*) > 1
  LOOP
    SELECT u.id INTO winner_id
    FROM public.users u
    WHERE LOWER(u.telegram_username) = grp.tg
    ORDER BY (u.auth_user_id IS NOT NULL)::int DESC,
             COALESCE(u.is_claimed,false) DESC,
             (u.telegram_photo_url IS NOT NULL AND u.telegram_photo_url <> '')::int DESC,
             COALESCE(u.is_vibe_resident,false) DESC,
             u.created_at ASC NULLS LAST
    LIMIT 1;

    cnt := 0;
    FOR loser_row IN
      SELECT u.id FROM public.users u
      WHERE LOWER(u.telegram_username) = grp.tg AND u.id <> winner_id
    LOOP
      IF NOT dry_run THEN
        PERFORM public.admin_merge_user_pair(winner_id, loser_row.id);
      END IF;
      cnt := cnt + 1;
    END LOOP;

    tg_username := grp.tg;
    primary_id := winner_id;
    merged_count := cnt;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Lock down execution: only admins (enforced inside) — but no anon execution either.
REVOKE EXECUTE ON FUNCTION public.admin_preview_telegram_username_duplicate_groups() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_merge_user_pair(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_auto_merge_telegram_username_duplicates(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_telegram_username_duplicate_groups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merge_user_pair(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_auto_merge_telegram_username_duplicates(boolean) TO authenticated;
