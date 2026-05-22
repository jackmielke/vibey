# Two daily heartbeats

Replace the one-shot `daily-recap` with a proper heartbeat system: morning brief (6am PT) and evening reflection (9pm PT), both sounding like Vibey, both showing their work.

## What changes for you

- **6am PT** — morning text from Vibey: what's coming today, who to check on, what to bring to the call
- **9pm PT** — evening text from Vibey: what happened, what's worth remembering, anything to follow up on tomorrow
- **Heartbeats tab** in admin showing each run with full reasoning trace — system prompt, tools she called, what she found, final message, token cost. Like chat history but for her scheduled work.
- **Per-user toggle** in the Telegram Mini app so people can opt in/out of morning, evening, or both
- Vibey's voice — no more hardcoded "TEXT MESSAGE" override. The soul prompt runs as-is; the heartbeat just gives it task context.

## How it works

```text
pg_cron (6am PT)  ──┐
pg_cron (9pm PT)  ──┴──► scheduled-heartbeat fn
                              │
                              ├─ load automation row (kind: morning|evening)
                              ├─ load recipients (opted-in users)
                              ├─ for each recipient:
                              │    └─ run chat-with-vibey agent loop
                              │         with seed prompt like:
                              │         "it's morning, write jack his brief.
                              │          use your tools to look things up."
                              │         ↓
                              │       she calls tools: granola, events,
                              │       relationships, recent chats
                              │         ↓
                              │       final message
                              ├─ persist heartbeat_run (prompt, tool calls,
                              │   thoughts, final text, tokens, duration)
                              └─ deliver via Telegram
```

## Technical details

**DB migration**

- `heartbeat_runs` table: `id, automation_id, kind, recipient_user_id, recipient_chat_id, system_prompt, seed_prompt, tool_calls jsonb, intermediate_thoughts jsonb, final_message text, tokens_used, duration_ms, status, error, created_at`
- `heartbeat_subscriptions` table: `user_id, kind ('morning'|'evening'), enabled, telegram_chat_id` — defaults to enabled-on-create for all current Telegram-linked users via a seed insert.

**Edge functions**

- New `scheduled-heartbeat/index.ts` — accepts `{ kind, automation_id?, dry_run?, user_id? }`. Loads opted-in recipients, runs the agent loop per recipient, persists trace, delivers.
- Refactor: extract the agent loop from `chat-with-vibey/index.ts` into `supabase/functions/_shared/vibey-agent.ts` so heartbeat can reuse tool-calling. (You already have this file — I'll extend it.)
- `daily-recap` stays for now but gets deprecated in the UI; can delete later.

**Cron**

- Two `pg_cron` jobs: `0 13 * * *` (6am PT) and `0 4 * * *` (9pm PT), both `net.http_post` to `scheduled-heartbeat` with `{ kind }`.

**Frontend**

- New `src/pages/Heartbeats.tsx` admin page listing `heartbeat_runs` grouped by day, expandable to see reasoning trace (reuse the styling pattern from `AutomationRunsPanel`).
- New sidebar link.
- Telegram Mini app: new "heartbeats" row in settings/preferences tab with two toggles (morning / evening).

**Prompting**

- Drop the `defaultInstructions` block. Use `agent.system_prompt` straight.
- Seed prompt per kind, ~2 sentences of *task* context only:
  - morning: "it's 6am pacific. write jack his morning brief — what's coming up today, who he should check in with, anything to bring to the daily call. use your tools to look things up."
  - evening: "it's 9pm pacific. text jack a reflection on the day — what happened, who showed up, what's worth remembering, anything to follow up on tomorrow."

## What I'm NOT doing in this pass

- Won't delete `daily-recap` yet (keep as fallback during rollout)
- Won't build per-user *custom* prompts — same seed for everyone, her soul handles the personalization
- Won't wire RSS/email/anything beyond Telegram

## Open questions before I build

1. Recipients: should evening go to the **same** list as morning, or do you want them configured independently from day one? (My default: same list, both default-on.)
2. Should the agent loop actually fetch *live* Granola + events + recent chats as tools she calls (slower, ~15-30s per run, more honest), or pre-stuff that context into the seed prompt like today (fast, dumber)? My strong preference: real tool loop.

If both default answers work, just say "go" and I'll ship it.