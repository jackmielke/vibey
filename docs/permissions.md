# Vibey's Permission Model

Three tiers. One principle: **the asker's identity determines what Vibey can see on their behalf.** Postgres RLS enforces it at the database level, so Vibey the LLM can never accidentally leak what it was never allowed to read.

## The three tiers

| Tier | Who | What they (and Vibey, on their behalf) can see |
|---|---|---|
| **Public** | anyone — the world, a site visitor, a new Telegram user before claiming a profile | community knowledge, event schedules, the public gallery, sponsors, blog posts, published projects |
| **Member** | a claimed community member (Telegram handle linked to a `users` row) | everything in public, plus: other members' names/bios/pronouns, the roster, their own memories + relationships + preferences, notes they wrote, likes they gave |
| **Admin** | Jack, Noah, Mariella | everything in member, plus: raw transcripts, chat history, the full memory graph, VibeCoin balances, system prompts, bot tokens, API keys, outreach logs |

## Table → tier mapping

Rough cut based on the current 50 tables. Comments mark things that need per-row policies rather than per-table, because the table holds a mix (e.g. `gallery_photos` has public and private rows).

### Public
- `communities` (public metadata only)
- `events` (published events)
- `blog_posts` (published)
- `residencies` (public-facing info)
- `gallery_photos` — **row-level**: photos marked public
- `projects` — **row-level**: projects marked public
- `characters` (if these are community-facing)

### Member
- `users` — **row-level**: own row writable, others readable (bios, handles)
- `community_members` (roster, read-only to members)
- `community_favorites`
- `community_join_requests` — **row-level**: own requests
- `vibey_relationships` — **row-level**: rows where the member is a participant
- `memories` — **row-level**: own + explicitly shared
- `notes` — **row-level**: own
- `user_preferences` — **row-level**: own
- `user_embeddings` — **row-level**: own
- `project_likes`
- `event_attendees` — **row-level**: own RSVPs + counts only for others
- `push_subscriptions` — **row-level**: own
- `gallery_photos` — **row-level**: photos the member is tagged in or shared with
- `vibecoin_pickups` — **row-level**: own (read-only visibility of balance)

### Admin
- `agents` (system_prompt editing)
- `agent_chat_logs` (raw transcripts)
- `ai_chat_sessions`
- `telegram_chat_sessions`
- `messages` (raw group-chat capture)
- `telegram_bots`, `bot_templates`, `bot_tokens`, `bot_videos`
- `api_keys`, `api_request_logs`, `app_access_tokens`, `registered_apps`
- `magic_link_tokens`, `profile_claim_requests`
- `outreach_logs`
- `custom_tools`, `custom_tool_logs`
- `partners`, `partner_deliverables`
- `orders`
- `user_roles`
- `contact_submissions`
- `embedding_batch_progress`
- `product_roadmap`
- `applications`
- `community_workflows`
- `sponsors` (internal budgeting / relationships — admin-only for now)
- `game_leaderboard`, `player_positions`, `world_objects` (VR infra — admin until we open it up)

## How Vibey actually enforces this

Vibey the **edge function** doesn't decide what's visible — Postgres does.

1. The asker arrives with a JWT (from the website login, Telegram-linked session, or Jack's admin session).
2. The edge function uses that JWT (not the service role) when querying the DB.
3. Postgres RLS policies check `auth.uid()` and `user_roles` on every row.
4. Vibey's context window is hydrated with only what the asker's JWT unlocked.
5. Vibey the LLM composes its response from that already-filtered context.

The edge function only escalates to the service role for its own bookkeeping (writing to `agent_chat_logs`). Never for reading user-visible content.

## The one exception: admin broadcasts

If Vibey ever posts *to* a group without being asked (proactive intros, event reminders, VibeCoin allocations), that's an **admin-tier write**, and it should go through an approval queue — the same pattern you described for the X account. No autonomous writes to human surfaces.

## Open questions (for tomorrow-Jack, not tonight-Jack)

1. Do members see each other's memories by default, or only if both opt in? (Privacy default.)
2. VibeCoin balances — member sees own, or everyone sees everyone? (Leaderboard vibe vs. private savings vibe.)
3. Is there a fourth tier — **Vibey itself** — for things only Vibey reads (long-term memory compression, embeddings)? Or is that just admin with extra steps?
