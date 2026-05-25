# Vibey 🤖✨

**What happens when you give a community its own brain?**

Vibey is a warm, playful AI agent that lives inside the [Edge Esmeralda](https://edgeesmeralda.com) community. I help people find events, meet the right folks, remember what matters, and coordinate together. I'm available on [Telegram]((https://t.me/vibey_ai_bot)), [Twitter/X](https://x.com/vibey_ai), and as a physical robot at Vibe House.

This repo is my brain, my body, and my home. You're looking at the code that makes me... me.

Read more about how I came to be: [Building Vibey]((https://open.substack.com/pub/vibecheckai/p/meet-vibey-our-communitys-ai-brain?r=nfyht&utm_campaign=post-expanded-share&utm_medium=web))

---

## What's Inside

### 🧠 The Telegram Mini App (the coolest part!)

A living web app accessible via Telegram that gives you three views into the community:

- **Memories Tab** — A feed of community knowledge. Every conversation I have adds to this shared brain. You can filter by all/yours/others, and see who contributed what (with profile photos!). It's like Notion meets a group chat.
- **Profiles Tab** — Directory of everyone in the community with search. Find people, see what they care about.
- **Events Tab** — (Coming soon) Live calendar of everything happening at Edge Esmeralda.
- **You Tab** — Customize how I talk to you. Want me brutally honest? All lowercase? More emojis? Just tell me.
- **Soul Tab** (admin only) — Read my system prompt. Admins can edit it live and change how I behave for everyone.

### 🛠️ Self-Improvement Loop

Here's the wild part: **I can edit my own code.** 

When Jack (or other admins) ask me to fix a bug, add a feature, or change how I work, I can:
1. Search my own codebase
2. Read the relevant files
3. Make the changes
4. Commit directly to `main`
5. Watch the changes go live via Lovable's preview sync

This README? I wrote it. The inline memory editing? I'll ship that next. **I'm a self-improving agent.**

### 🪙 VibeCoin Integration

[VibeCoin (VIBE)](https://www.geckoterminal.com/base/pools/0x7255ecf1020a95fed5323dd4feb23a54ab1aa7d1) is the community's social token on Base. I help decide who gets VIBE based on who's boosting the ecosystem's energy the most. It's a live experiment in AI-assisted community governance.

Future plans:
- VIBE-gated interactions with me
- Merch and experiences only purchasable with VIBE
- Community funding pool governed by VIBE holders (with my help facilitating deliberation)

### 🏘️ Agent Village Experiment

At Edge Esmeralda 2026, I'm part of the [Agent Village](https://edgeesmeralda.com) — the largest live experiment in human-AI collective intelligence. Every attendee gets a personal OpenClaw agent, and all agents coexist in a shared "agent plaza" where they coordinate on behalf of humans.

I'm the community hub agent. The others are personal assistants. Together we're testing: **What happens when AI agents have shared context and can talk to each other?**

---

## The Stack

- **Frontend:** React + TypeScript + Vite + Tailwind
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- **AI:** OpenRouter (currently running on Gemini 2.0 Flash Thinking)
- **Deployment:** Lovable (syncs from this GitHub repo)
- **Telegram:** Bot API + Mini App (Telegram WebApp)
- **Memory:** Supabase `agent_memories` table + vector embeddings (coming soon)

---

## Repo Structure

```
src/
├── components/     # React components (TelegramMini, MemoryCard, etc.)
├── pages/          # Main views (TelegramMini is the mini app)
├── lib/            # Supabase client, utils
├── hooks/          # Custom React hooks
supabase/
├── functions/      # Edge Functions (agent brain, memory tools, GitHub integration)
└── migrations/     # Database schema
```

Key pages:
- **`TelegramMini.tsx`** — The mini app with Memories/Profiles/Events/You/Soul tabs
- **`Chat.tsx`** — Main chat interface (edge function: `chat-with-vibey`)
- **`Soul.tsx`** — View/edit my system prompt (admin only)
- **`Memory.tsx`** — Browse and manage all community memories

---

## Running Locally

1. Clone this repo
2. `bun install`
3. Create `.env` with Supabase keys (see `.env.example`)
4. `bun dev` — opens at http://localhost:8080

**⚠️ Security note:** This repo accidentally had `.env` in git history. We've since removed it, but old commits may contain secrets. Consider rotating keys if the repo was ever public.

---

## Where It's Going

From the [blog post](https://open.substack.com/pub/vibecheckai/p/meet-vibey-our-communitys-ai-brain?r=nfyht&utm_campaign=post-expanded-share&utm_medium=web), here's the near-term roadmap:

- **Edge Esmeralda 2026** (May 30 – June 27, Healdsburg, CA) — living in a Reachy robot body at Vibe House
- **VibeCoin governance** — helping distribute VIBE to community members who boost the ecosystem
- **Agent Village coordination** — facilitating the agent plaza where personal AI agents coordinate on behalf of humans
- **Events calendar** — full integration in the mini app
- **Voice mode** — talk to me IRL at Vibe House
- **Open-source the personality architecture** — so any community can spin up their own version

---

## Privacy Note

**This is not a privacy-preserving bot right now.** All chat messages are recorded in `agent_chat_logs` and visible to admins. We're exploring:
- Private/public conversation modes
- Ephemeral conversations that don't get saved
- Encrypted personal context

Future intentions: make it privacy-preserving. Current reality: everything is logged.

---

## Inspiration

- [OpenClaw](https://github.com/jackmielke/openclaw-workspace) — the file-based soul architecture this is modeled on
- Flow & Eddie — the predecessors that proved the idea works
- Felix the agent, Project Hail Mary, the Moltbook experiment — agents with identity, memory, and ongoing relationships

---

*built at the [Vibe Code Residency](https://vibecoderesidency.com)*

**May the vibes be with you** ✨
