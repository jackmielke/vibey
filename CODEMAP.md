# CODEMAP — How Vibey thinks, end to end

> Read this first if you're (a) Vibey trying to edit yourself, or (b) a human trying to make a code change. It will save you 10 exploration steps. The brain lives in **one file**: `supabase/functions/_shared/vibey-agent.ts`.

---

## 1. The surface map — where messages come in and go out

```mermaid
flowchart LR
    subgraph Surfaces ["SURFACES"]
        S1["Web admin chat<br/>src/pages/Chat.tsx"]
        S2["Telegram (DM or group)<br/>via vibey_ai_bot"]
        S3["Public chat<br/>src/pages/PublicChat.tsx"]
        S4["Telegram Mini App<br/>src/pages/TelegramMini.tsx"]
    end

    subgraph Edge ["EDGE FUNCTIONS (the adapters)"]
        E1["chat-with-vibey<br/>streams SSE to the browser"]
        E2["telegram-webhook<br/>sendMessage / sendVoice / sendAudio"]
    end

    subgraph Brain ["THE BRAIN (one shared module)"]
        B["supabase/functions/_shared/vibey-agent.ts<br/><b>runAgentLoop()</b>"]
    end

    S1 --> E1
    S3 --> E1
    S2 --> E2
    S4 -.uses Supabase tables + helpers.-> Brain

    E1 --> B
    E2 --> B
```

**The rule:** every chat-shaped feature, regardless of surface, eventually calls `runAgentLoop` in `_shared/vibey-agent.ts`. If you want to change *how Vibey thinks*, you edit there — not in `src/lib/`, not in a per-surface edge function.

---

## 2. One request, step by step (inside runAgentLoop)

```mermaid
flowchart TD
    M["User message arrives<br/>(text + maybe images / voice)"]

    subgraph Hydrate ["HYDRATE — context loaded in parallel"]
        H1["Load agents row<br/>system_prompt + model + temp"]
        H2["Load recent memories<br/>(memories table)"]
        H3["Load upcoming events<br/>(events table)"]
        H4["Load user prefs<br/>(vibey_relationships)"]
        H5["Load enabled skills"]
        H6["Load chat history<br/>(last 10 exchanges, agent_chat_logs)"]
        H7["Inject current Pacific Time"]
    end

    A["Assemble system prompt<br/>buildSystemPromptWithMemories()"]
    L["OpenRouter call<br/>anthropic/claude-sonnet-4.5"]
    D{"Tool calls<br/>in response?"}
    T["Execute tools<br/>(save_memory, web_search,<br/>github_commit_file, etc.)"]
    R["Append tool results<br/>back into messages array"]
    F["Final text reply"]
    Log[("Persist exchange to<br/>agent_chat_logs")]
    Send["Send back to surface<br/>(SSE / sendMessage)"]
    Cap["Hard cap: 25 iterations<br/>then forced final reply"]

    M --> Hydrate
    Hydrate --> A
    A --> L
    L --> D
    D -->|yes| T
    T --> R
    R --> L
    D -->|no| F
    F --> Log
    F --> Send
    D -.-> Cap
```

**Key constants** (in `_shared/vibey-agent.ts`):
- `MAX_TOOL_ITERATIONS = 25` — how many tool-call rounds before Vibey is forced to write a final reply
- `VIBEY_AGENT_ID` / `VIBEY_COMMUNITY_ID` — the canonical row IDs (single-agent today, multi-tenant DB)
- `ADMIN_TELEGRAM_USER_IDS` — who can trigger admin tools (`github_*`, `/voice`, etc.)

---

## 3. Where the code lives (the file map)

```mermaid
flowchart LR
    subgraph Frontend ["FRONTEND (React + Vite + Tailwind)"]
        F1["src/pages/Chat.tsx<br/>admin web chat"]
        F2["src/pages/TelegramMini.tsx<br/>mini app (Memories / Profiles /<br/>Events / You / Soul tabs)"]
        F3["src/pages/PublicChat.tsx"]
        F4["src/pages/Soul.tsx<br/>edit Vibey's system prompt live"]
        F5["src/pages/Memory, Skills, Tools,<br/>Relationships, Conversations,<br/>Events, Heartbeats, Calendar,<br/>MissionControl, Automations"]
        F6["src/components/AdminLayout.tsx<br/>+ AppSidebar.tsx (routes)"]
    end

    subgraph EdgeFns ["EDGE FUNCTIONS (Deno)"]
        E1["chat-with-vibey/index.ts"]
        E2["telegram-webhook/index.ts"]
        E3["_shared/vibey-agent.ts<br/><b>THE BRAIN</b><br/>runAgentLoop, tools registry,<br/>buildSystemPromptWithMemories,<br/>github_* implementations"]
        E4["scheduled-heartbeat<br/>daily-recap<br/>vibey-cron, vibey-digest"]
        E5["community-events, api-gallery,<br/>elevenlabs-session, etc."]
    end

    subgraph DB ["SUPABASE POSTGRES"]
        D1["agents<br/>system_prompt, model, temp"]
        D2["memories"]
        D3["events"]
        D4["vibey_relationships<br/>per-user preferences"]
        D5["agent_chat_logs<br/>every exchange logged"]
        D6["agents_skills"]
        D7["github_agent_actions<br/>self-edit audit log"]
        D8["telegram_group_settings,<br/>telegram_processed_updates"]
    end

    F1 --> E1
    F2 --> E1
    F2 --> E5
    F3 --> E1
    F4 -- edits --> D1
    E1 --> E3
    E2 --> E3
    E3 --> D1
    E3 --> D2
    E3 --> D3
    E3 --> D4
    E3 --> D5
    E3 --> D6
    E3 --> D7
```

---

## 4. Decision tree — "I want to change X, where do I edit?"

| If you want to change… | Edit here | NOT here |
|---|---|---|
| Vibey's voice / personality | `agents.system_prompt` via the Soul tab in the admin UI (live, no deploy) | Anywhere in code |
| What tools Vibey can call | `_shared/vibey-agent.ts` — tools registry + executor switch | Per-surface edge function |
| What context Vibey loads | `buildSystemPromptWithMemories` and `loadX` helpers in `_shared/vibey-agent.ts` | `src/lib/` |
| How Telegram messages are parsed / rendered | `supabase/functions/telegram-webhook/index.ts` | `_shared/vibey-agent.ts` |
| How the web chat streams | `supabase/functions/chat-with-vibey/index.ts` + `src/pages/Chat.tsx` | `_shared/vibey-agent.ts` |
| Add a tab to the mini app | `src/pages/TelegramMini.tsx` | New file |
| Add a page to the web admin | New file in `src/pages/`, register route in `src/App.tsx` + `src/components/AppSidebar.tsx` | — |
| Add a DB column or table | New SQL file in `supabase/migrations/` + apply via Supabase MCP `apply_migration` | Raw SQL ad hoc |
| Add a scheduled background task | Edge function + cron entry; pattern lives in `scheduled-heartbeat` | — |
| Change Vibey's max steps per turn | `MAX_TOOL_ITERATIONS` in `_shared/vibey-agent.ts` | — |
| Add/remove an admin | `ADMIN_TELEGRAM_USER_IDS` in `_shared/vibey-agent.ts` | RLS policies |

---

## 5. Tools Vibey can currently call (high level)

**Memory:**
- `save_memory(content, tags?)`, `update_memory(id, content, tags?)`

**Web:**
- `web_search(query)`, `fetch_url(url)`, `get_vibe_price(...)`

**Self-edit (admin only):**
- `github_list_recent_commits`, `github_search_code` *(unreliable on this repo, prefer dir+read)*, `github_list_dir`, `github_read_file`, `github_commit_file`, `github_delete_file`

**Skills & tools:** dynamically loaded from `agents_skills` + the tools table.

---

## 6. Things to remember

1. **The brain is one file.** `_shared/vibey-agent.ts` is 92 KB. Big, but it's *the* canonical place. Don't fork it into `src/lib/`. (There used to be a dead `src/lib/chat.ts` from a confused self-edit attempt — it was deleted on 2026-05-20 with extreme prejudice.)
2. **Soul lives in the DB**, not in code. The Soul tab edits a single row.
3. **Vibey is admin-gated for code edits.** Only Telegram IDs in `ADMIN_TELEGRAM_USER_IDS` can trigger `github_*` tools or `/voice`. Standard users see no escalation.
4. **The DB is multi-tenant by design** (299 communities, 2 agents) but the app is hardcoded to one. Don't assume "the agent" or "the community" — use `VIBEY_AGENT_ID` and `VIBEY_COMMUNITY_ID`.
5. **`agent_chat_logs.session_key`** unifies sessions across surfaces. `telegram:<chat_id>` and `web:<auth_id>` are the two flavors.
6. **Time is anchored to Pacific.** Edge / Vibe House are in California. Telegram doesn't expose timezone, so PT is the default. If a user says they're elsewhere, Vibey can adapt from this anchor.
