# Vibey - Community AI Assistant

> the resident AI of the Vibe community. think of it like a team member who happens to have perfect memory, knows everyone, never sleeps, and (eventually) lives in a robot body.

Vibey is what happens when you give a community its own brain.

Read the full backstory: [Meet Vibey: What Happens When You Give a Community Its Own Brain](https://jackmielke.notion.site/Meet-Vibey-Our-Community-s-AI-Brain-336669d2c0d5812b8c53f3e0aece192f)

---

## Why Vibey exists

Every community — especially pop-up ones like residencies, conferences, and villages — has the same problem: the information that matters most lives in someone's head, or in a Telegram thread from three days ago nobody's going to scroll back through. The bigger the group, the more gets lost.

Vibey's job is to be the place that stuff goes so it doesn't disappear. An AI that actually participates in the social life of a community, not a chatbot with canned responses.

## Personality

Vibey's personality is inspired by [OpenClaw](https://github.com/jackmielke/openclaw-workspace), but adapted to be social and community-native by default. We're not locking it into a fixed persona — we want its character to evolve as the community gets to know it, becoming more recognizable, more lovable, and more itself over time.

It has a layered architecture that separates **who Vibey is** — direct, warm, playful, honest, and texting in lowercase like a real person — from **what it learns and remembers**: community knowledge, individual relationships, personal preferences, and live context from events, Telegram chats, and Granola notes.

The result is an AI that feels less like a chatbot and more like a free spirit — a kind of collective consciousness that grows with the community.

## What's in this repo

This repo is the **admin dashboard + brain** for Vibey: soul, memory, surfaces, and the edge functions that power conversations.

### Web app (`src/`)

| Area | Purpose |
|------|---------|
| **`pages/Chat`** | Main chat with Vibey (edge: `chat-with-vibey`) |
| **`pages/LovableChat`** | Alternate chat path via `lovable-chat` function |
| **`pages/Login`** | Auth gate for admins |
| **`pages/MissionControl`** | Routed at `/dashboard` — mission-style overview |
| **`pages/Dashboard`** | Routed at `/sections` — section overview |
| **`pages/Soul`**, **`Identity`**, **`Memory`**, **`Media`** | Persona and recall |
| **`pages/Tools`**, **`Skills`** | Tooling and skill configuration |
| **`pages/Relationships`**, **`Conversations`**, **`Groups`** | People and threads |
| **`pages/Interfaces`** | Surfaces Vibey runs on |
| **`pages/Automations`** | Automation runs and wiring |
| **`pages/TelegramMini`** | Telegram mini-app surface (`/mini`) |

Protected routes sit behind **`RequireAdmin`** + **`AdminLayout`** (see `src/App.tsx`).

### Backend (`supabase/`)

- **`functions/`** — Edge Functions (e.g. `chat-with-vibey`, `telegram-webhook`, `lovable-chat`, automations, voice, daily recap). Shared agent logic lives under **`functions/_shared/`**.
- **`migrations/`** — Database schema for the shared Vibe community project (**coordinate changes** with other Vibe repos).

## Tech stack

Vite · React · TypeScript · Tailwind · shadcn/ui · TanStack Query · React Router · Supabase · Vitest

## Environment variables

Configuration uses **Vite** env vars (must be prefixed with `VITE_`).

1. Copy **`.env.example`** → **`.env`**.
2. In the Supabase dashboard: **Project Settings → API**, copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **Project ref** (matches the subdomain) → `VITE_SUPABASE_PROJECT_ID`

Never commit **`.env`**. The publishable key is the **anon** client key; real access control is enforced with **Row Level Security** in Supabase. Do **not** put the **service_role** secret in any `VITE_*` variable — it would ship in the browser bundle.

## Security note (Git history)

If **`.env` was ever pushed to GitHub**, assume those values appeared in git history until removed. After untracking `.env`:

- **Future pushes** no longer add the file if you keep `.gitignore` as above.
- **Past commits** may still contain old values; consider **rotating** the anon key in Supabase if the repo was public or widely cloned, and use history rewriting (e.g. `git filter-repo`) only if your team is comfortable force-pushing shared branches.

## Running locally

```bash
bun install
bun dev        # http://localhost:8080 (see vite.config.ts)
bun test       # vitest
bun run build
```

Shared Supabase project access is by invitation — ping Jack if you need credentials for the Vibe org project.

## Where it's going

From the blog post, here's the near-term roadmap:

- Telegram presence in the Vibe community group chat
- Granola integration for capturing workshop/meeting context
- X account for community highlights
- Reachy robot body at Edge Esmeralda (May 30 – June 27, Healdsburg, CA)
- VibeCoin allocation — Vibey rewards community members who boost the collective vibe
- Eventually: open-source the personality architecture so any community can spin up its own version

## Inspiration

- [OpenClaw](https://github.com/jackmielke/openclaw-workspace) — the file-based soul architecture this is modeled on
- Flow & Eddie — the predecessors that proved the idea works
- Felix the agent, Project Hail Mary, the Moltbook experiment — agents with identity, memory, and ongoing relationships

---

*built at the [Vibe Code Residency](https://vibecoderesidency.com)*

**TEST LINE - Vibey can write to GitHub!**
