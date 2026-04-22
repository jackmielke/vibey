# Vibey

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

This repo is the **admin dashboard + brain** for Vibey. It's where Vibey's soul lives, where community members can peek inside its mind, and where conversations across surfaces flow through.

- **`src/pages/`** — the admin UI
  - `Chat` — talk to Vibey directly
  - `Soul` / `Identity` — who Vibey is
  - `Memory` — what Vibey remembers
  - `Relationships` — per-person context
  - `Conversations` / `Groups` — threads across surfaces
  - `Interfaces` — the surfaces Vibey lives on (Telegram, website, X, robot)
  - `Media` / `Dashboard`
- **`supabase/functions/chat-with-vibey/`** — the edge function that actually runs a conversation
- **`supabase/migrations/`** — the schema for the Vibe community database (shared across Vibe projects, so tread carefully)

## Tech stack

Vite · React · TypeScript · Tailwind · shadcn/ui · TanStack Query · React Router · Supabase (shared Vibe community project) · Vitest

## Running locally

```bash
bun install
bun dev        # http://localhost:5173
bun test       # vitest
bun run build
```

Supabase credentials live in the environment — ask Jack if you need access to the shared Vibe project.

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
