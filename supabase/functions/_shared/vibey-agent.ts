// Shared agentic loop for Vibey, used by both `chat-with-vibey` (web) and
// `telegram-webhook`. Implements a minimal "OpenAI-style" tool-calling loop:
//
//   while (model returns tool_calls) { execute them, append results, call again }
//
// "OpenAI-style" is just the JSON wire format that Claude, Gemini, GPT, and
// Llama all accept via OpenRouter — it has nothing to do with using OpenAI
// models specifically. This file is the single source of truth for tools.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
export const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

// Telegram user IDs that get full admin powers (edit Vibey's soul, memories,
// skills, and tools via conversation). Standard users get read-only powers.
export const ADMIN_TELEGRAM_USER_IDS = new Set<number>([
  5780091237, // Jack Mielke
]);

export function isAdminTelegramUser(telegramUserId: number | null | undefined): boolean {
  return telegramUserId != null && ADMIN_TELEGRAM_USER_IDS.has(telegramUserId);
}

// Auto-load this many recent memories into the system prompt every turn.
// (We can swap this for a `recall_memories` tool later when the corpus grows.)
export const MEMORY_PRELOAD_LIMIT = 50;

export type ImageInput = { url: string; detail?: "low" | "high" | "auto" };

export type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | UserContentPart[] | null;
  // OpenAI-format tool calling
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

export type Memory = {
  id: string;
  content: string | null;
  tags: string[] | null;
  created_at: string;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
};

// ── Tool spec ────────────────────────────────────────────────────────────────
//
// One tool for now: save_memory. Recall happens by auto-injecting recent
// memories into the system prompt (see buildSystemPromptWithMemories below).

export const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "save_memory",
      description:
        "Save a notable fact or insight about the community to long-term memory so future Vibey responses can reference it. Use sparingly — only for genuinely useful, durable information (community norms, preferences, recurring topics, important people/projects). Do NOT save trivia, small talk, or per-message context.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description:
              "The memory itself, written as a self-contained statement. Example: 'The community hosts hackathons every Friday evening.'",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description:
              "1-4 short lowercase keyword tags to help future retrieval. Example: ['hackathons', 'schedule'].",
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_memory",
      description:
        "Update an existing memory's content and/or tags. You may ONLY update memories that the CURRENT user originally created (their id appears as `owner` in the memory list). If the user asks to change a memory they didn't create, politely refuse — don't call this tool. Always pass the full new content (not a diff).",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The UUID of the memory to update (from the memory list)." },
          content: { type: "string", description: "New full content for the memory." },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional replacement tags (1-4 short lowercase keywords). Omit to leave tags unchanged.",
          },
        },
        required: ["id", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search the live web (via Brave Search) for current information. Use when the user asks about recent events, news, prices, dates, or anything you can't answer from memory or the community context. Returns up to 5 result snippets with URLs. Follow up with fetch_url if you need full content from a specific page.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query, written as you'd type it into Google." },
          count: { type: "integer", description: "How many results to return (1-10). Default 5.", minimum: 1, maximum: 10 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_vibe_price",
      description:
        "Fetch the LIVE price of VibeCoin (VIBE on Base, contract 0x7255ecf1020a95fed5323dd4feb23a54ab1aa7d1) from GeckoTerminal, and optionally convert between USD and VIBE. Use this ANY time the user mentions VIBE, VibeCoin, 'vibes' as a token, sending/distributing VibeCoin, calculating how many VIBE equals a $ amount, or asking what their VIBE holdings are worth. Casual phrasings count too: 'how many vibes is $50', 'what's vibe at', 'how much vibe should I send my friend', 'what's my wallet worth'. NEVER answer VIBE pricing from memory or stale numbers — always call this tool. Returns price_usd, fdv_usd, liquidity_usd, 24h volume + change. If usd is provided, also returns vibe_amount; if vibe is provided, also returns usd_amount. Pool liquidity is thin (~$60-70K) — flag this only when the user is talking about distribution or selling.",
      parameters: {
        type: "object",
        properties: {
          usd: { type: "number", description: "Optional: USD amount to convert to VIBE." },
          vibe: { type: "number", description: "Optional: VIBE amount to convert to USD." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fetch_url",
      description:
        "Fetch the readable text content of a specific web page. Use when you have a URL (from web_search results or the user) and need the actual page content to answer accurately. Strips HTML and returns up to ~6000 characters of clean text. Do NOT use for social media or paywalled content — won't work well there.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL to fetch, including https://." },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "granola_notes",
      description:
        "Search Vibey's Granola meeting notes for community context. Use when the user asks about meeting notes, calls, workshops, decisions, action items, or anything they say they sent/shared to Vibey via Granola. This reads notes available to vibey@vibeventures.studio. Returns matching note titles, timestamps, summaries, and snippets.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Optional search text to match against note title, summary, transcript, or content.",
          },
          limit: {
            type: "integer",
            description: "Maximum number of notes to return. Default 10, max 25.",
            minimum: 1,
            maximum: 25,
          },
          created_after: {
            type: "string",
            description:
              "Optional ISO timestamp. Only return notes created after this time.",
          },
          created_before: {
            type: "string",
            description:
              "Optional ISO timestamp. Only return notes created before this time.",
          },
        },
      },
    },
  },
];

// ── Tool registry (DB-backed enabled/disabled) ──────────────────────────────

// ── Admin-only tools ────────────────────────────────────────────────────────
// These let trusted callers (admins) edit Vibey's own soul, memories, skills,
// and tool registry through conversation. They are NEVER exposed to the model
// when the caller is not an admin (filterTools strips them).

export const ADMIN_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "admin_update_soul",
      description:
        "ADMIN ONLY. Edit Vibey's own soul — system prompt, model, sampling settings. Use when an admin asks you to change your personality, tone defaults, instructions, or which model you run on. Pass only the fields you want to change. Be careful: this rewrites the LIVE prompt for everyone, immediately.",
      parameters: {
        type: "object",
        properties: {
          system_prompt: { type: "string", description: "Full new system prompt (replaces current)." },
          model: { type: "string", description: "OpenRouter model id, e.g. 'google/gemini-2.5-flash' or 'anthropic/claude-sonnet-4'." },
          temperature: { type: "number", description: "Sampling temperature 0-2." },
          max_tokens: { type: "integer", description: "Max output tokens per reply." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "admin_delete_memory",
      description: "ADMIN ONLY. Permanently delete a memory by id. Use when an admin says 'forget X' or 'delete that memory'.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Memory UUID from the memory list." } },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "admin_update_any_memory",
      description: "ADMIN ONLY. Update any memory regardless of who created it. Pass full new content.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["id", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "admin_upsert_skill",
      description:
        "ADMIN ONLY. Create or update a Vibey skill (a named playbook injected into the system prompt). Use when an admin says 'add a skill for X' or 'change the X skill'. Name must be a stable lowercase slug (e.g. 'crypto_pricing').",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Stable lowercase slug, unique." },
          label: { type: "string", description: "Human-readable name shown in admin UI." },
          description: { type: "string", description: "When to use this skill (one sentence)." },
          prompt: { type: "string", description: "The playbook itself — what to do when the skill applies." },
          category: { type: "string", description: "Optional grouping (default 'general')." },
          is_enabled: { type: "boolean", description: "Whether to enable immediately (default true)." },
        },
        required: ["name", "label", "description", "prompt"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "admin_toggle_skill",
      description: "ADMIN ONLY. Enable or disable an existing skill by name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          is_enabled: { type: "boolean" },
        },
        required: ["name", "is_enabled"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "admin_toggle_tool",
      description: "ADMIN ONLY. Enable or disable a built-in tool by name (e.g. 'web_search', 'granola_notes'). Tools you can toggle: web_search, fetch_url, granola_notes, get_vibe_price, save_memory, update_memory.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          is_enabled: { type: "boolean" },
        },
        required: ["name", "is_enabled"],
      },
    },
  },
];

// ── Tool registry (DB-backed enabled/disabled) ──────────────────────────────

export async function loadEnabledToolNames(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("agent_tools")
    .select("name, is_enabled")
    .eq("is_enabled", true);
  if (error) {
    console.error("loadEnabledToolNames failed:", error.message);
    // fall back to allowing all built-in tools
    return new Set(TOOLS.map((t) => t.function.name));
  }
  const rows = (data ?? []) as Array<{ name: string; is_enabled?: boolean }>;
  const enabled = new Set(rows.map((r) => r.name));

  // The remote migration history for this project can lag behind the deployed
  // function code. Let Granola work as soon as its secrets exist, while still
  // respecting the DB toggle once the `agent_tools` row has been inserted.
  const hasGranolaRegistryRow = rows.some((r) => r.name === "granola_notes");
  if (
    !hasGranolaRegistryRow &&
    Deno.env.get("GRANOLA_API_KEY")
  ) {
    enabled.add("granola_notes");
  }

  return enabled;
}

export function filterTools(enabled: Set<string>, isAdmin: boolean) {
  const base = TOOLS.filter((t) => enabled.has(t.function.name));
  return isAdmin ? [...base, ...ADMIN_TOOLS] : base;
}

// Back-compat alias for any external callers — defaults to non-admin.
export function filterToolsByEnabled(enabled: Set<string>) {
  return filterTools(enabled, false);
}

// ── Skills (DB-backed prompt playbooks) ─────────────────────────────────────

export type Skill = {
  name: string;
  label: string;
  description: string;
  prompt: string;
  category: string;
};

export async function loadEnabledSkills(supabase: SupabaseClient): Promise<Skill[]> {
  const { data, error } = await supabase
    .from("agent_skills")
    .select("name, label, description, prompt, category")
    .eq("is_enabled", true)
    .order("category")
    .order("label");
  if (error) {
    console.error("loadEnabledSkills failed:", error.message);
    return [];
  }
  return (data ?? []) as Skill[];
}

export function buildSkillsBlock(skills: Skill[]): string {
  if (skills.length === 0) return "";
  const lines = skills
    .map(
      (s) =>
        `### ${s.label} (${s.name})\n_When to use:_ ${s.description}\n_Playbook:_ ${s.prompt}`
    )
    .join("\n\n");
  return `\n\n## Skills (on-demand playbooks)\n\nThese are prompt-level behaviors you can invoke yourself when the user's request fits. Don't announce them by name — just follow the playbook.\n\n${lines}`;
}

// ── Memory store ─────────────────────────────────────────────────────────────

export async function loadRecentMemories(
  supabase: SupabaseClient,
  limit = MEMORY_PRELOAD_LIMIT
): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("memories")
    .select("id, content, tags, created_at, created_by, metadata")
    .eq("community_id", VIBEY_COMMUNITY_ID)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("loadRecentMemories failed:", error.message);
    return [];
  }
  return (data ?? []) as Memory[];
}

async function saveMemory(
  supabase: SupabaseClient,
  args: { content: string; tags?: string[] },
  metadata: Record<string, unknown> = {},
  callerVibeUserId: string | null = null
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const content = (args?.content ?? "").trim();
  if (!content) return { ok: false, error: "content is required" };
  const tags = Array.isArray(args?.tags)
    ? args.tags.filter((t) => typeof t === "string").slice(0, 6)
    : [];

  const { data, error } = await supabase
    .from("memories")
    .insert({
      community_id: VIBEY_COMMUNITY_ID,
      content,
      tags,
      metadata,
      created_by: callerVibeUserId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("save_memory failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id };
}

async function updateMemory(
  supabase: SupabaseClient,
  args: { id: string; content: string; tags?: string[] },
  callerVibeUserId: string | null
): Promise<{
  ok: boolean;
  id?: string;
  error?: string;
  before?: { content: string | null; tags: string[] | null };
  after?: { content: string; tags: string[] | null };
}> {
  const id = (args?.id ?? "").trim();
  const content = (args?.content ?? "").trim();
  if (!id) return { ok: false, error: "id is required" };
  if (!content) return { ok: false, error: "content is required" };
  if (!callerVibeUserId) {
    return { ok: false, error: "anonymous callers can't update memories — sign in first" };
  }

  // Fetch current row to confirm ownership and capture the "before" snapshot.
  const { data: existing, error: fetchErr } = await supabase
    .from("memories")
    .select("id, content, tags, created_by, community_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: "memory not found" };
  if (existing.created_by !== callerVibeUserId) {
    return {
      ok: false,
      error: "you can only update memories you originally created",
    };
  }

  const tagsProvided = Array.isArray(args?.tags);
  const tags = tagsProvided
    ? (args!.tags as string[]).filter((t) => typeof t === "string").slice(0, 6)
    : (existing.tags as string[] | null);

  const updatePatch: Record<string, unknown> = { content };
  if (tagsProvided) updatePatch.tags = tags;

  const { error: updErr } = await supabase
    .from("memories")
    .update(updatePatch)
    .eq("id", id);

  if (updErr) {
    console.error("update_memory failed:", updErr.message);
    return { ok: false, error: updErr.message };
  }

  return {
    ok: true,
    id,
    before: { content: existing.content, tags: existing.tags },
    after: { content, tags },
  };
}

// ── Web tools ────────────────────────────────────────────────────────────────

async function webSearch(args: { query: string; count?: number }): Promise<string> {
  const query = (args?.query ?? "").trim();
  if (!query) return JSON.stringify({ ok: false, error: "query is required" });
  const count = Math.max(1, Math.min(10, Number(args?.count) || 5));

  const apiKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
  if (!apiKey) return JSON.stringify({ ok: false, error: "BRAVE_SEARCH_API_KEY not configured" });

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    const resp = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey,
      },
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return JSON.stringify({ ok: false, error: `Brave ${resp.status}: ${txt.slice(0, 200)}` });
    }
    const json = await resp.json();
    // deno-lint-ignore no-explicit-any
    const results = (json?.web?.results ?? []).slice(0, count).map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age,
    }));
    return JSON.stringify({ ok: true, query, results });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

async function fetchUrl(args: { url: string }): Promise<string> {
  const url = (args?.url ?? "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return JSON.stringify({ ok: false, error: "valid http(s) url required" });
  }

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VibeyBot/1.0; +https://community-vibes-ai.lovable.app)",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9",
      },
      redirect: "follow",
    });
    if (!resp.ok) {
      return JSON.stringify({ ok: false, error: `HTTP ${resp.status}`, url });
    }
    const contentType = resp.headers.get("content-type") || "";
    const raw = await resp.text();

    let text: string;
    if (contentType.includes("html")) {
      // Strip scripts/styles, then tags, collapse whitespace.
      text = raw
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    } else {
      text = raw.trim();
    }

    const truncated = text.length > 6000;
    return JSON.stringify({
      ok: true,
      url,
      content: text.slice(0, 6000),
      truncated,
      original_length: text.length,
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

// ── Granola notes tool ───────────────────────────────────────────────────────

const GRANOLA_ACCOUNT_EMAIL = "vibey@vibeventures.studio";

type GranolaNote = {
  id?: string;
  title?: string;
  owner?: { name?: string; email?: string };
  created_at?: string;
  updated_at?: string;
  summary_text?: string;
  summary_markdown?: string | null;
  summary?: string;
  text?: string;
  content?: string;
  transcript?: string | Array<{ text?: string; speaker?: { source?: string; diarization_label?: string } }>;
  url?: string;
  web_url?: string;
};

function compactGranolaText(note: GranolaNote): string {
  const transcript = Array.isArray(note.transcript)
    ? note.transcript.map((item) => item.text).filter(Boolean).join("\n")
    : note.transcript;

  return [
    note.title,
    note.summary_text,
    note.summary_markdown ?? undefined,
    note.summary,
    note.text,
    note.content,
    transcript,
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchGranolaNotes(args: {
  query?: string;
  limit?: number;
  created_after?: string;
  created_before?: string;
}): Promise<string> {
  const GRANOLA_API_KEY = Deno.env.get("GRANOLA_API_KEY");
  if (!GRANOLA_API_KEY) {
    return JSON.stringify({
      ok: false,
      error: "Granola notes are not configured. Missing GRANOLA_API_KEY.",
      account_email: GRANOLA_ACCOUNT_EMAIL,
    });
  }

  const requestedLimit = Math.max(1, Math.min(25, Number(args?.limit) || 10));
  const query = (args?.query ?? "").trim().toLowerCase();
  const fetchLimit = query ? 30 : Math.min(30, requestedLimit);
  const params = new URLSearchParams({ page_size: String(fetchLimit) });
  if (args?.created_after) params.set("created_after", args.created_after);
  if (args?.created_before) params.set("created_before", args.created_before);

  try {
    const resp = await fetch(
      `https://public-api.granola.ai/v1/notes?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${GRANOLA_API_KEY}`,
        },
      }
    );

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return JSON.stringify({
        ok: false,
        error: `Granola ${resp.status}: ${text.slice(0, 300)}`,
        account_email: GRANOLA_ACCOUNT_EMAIL,
      });
    }

    const json = await resp.json();
    const listedNotes = (Array.isArray(json?.notes) ? json.notes : []) as GranolaNote[];
    const rawNotes = await Promise.all(
      listedNotes.map(async (note) => {
        if (!note.id) return note;
        const detailResp = await fetch(
          `https://public-api.granola.ai/v1/notes/${encodeURIComponent(note.id)}?include=transcript`,
          {
            headers: {
              Authorization: `Bearer ${GRANOLA_API_KEY}`,
            },
          }
        );
        if (!detailResp.ok) return note;
        return (await detailResp.json()) as GranolaNote;
      })
    );

    const matchingNotes = query
      ? rawNotes.filter((note) => compactGranolaText(note).toLowerCase().includes(query))
      : rawNotes;

    const notes = matchingNotes.slice(0, requestedLimit).map((note) => {
      const body = compactGranolaText(note);
      return {
        id: note.id ?? null,
        title: note.title ?? "Untitled Granola note",
        owner: note.owner ?? null,
        created_at: note.created_at ?? null,
        updated_at: note.updated_at ?? null,
        summary: note.summary_text ?? note.summary_markdown ?? note.summary ?? null,
        snippet: body.slice(0, 1200),
        url: note.web_url ?? note.url ?? null,
      };
    });

    return JSON.stringify({
      ok: true,
      account_email: GRANOLA_ACCOUNT_EMAIL,
      query: query || null,
      count: notes.length,
      fetched_count: rawNotes.length,
      notes,
    });
  } catch (e) {
    return JSON.stringify({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      account_email: GRANOLA_ACCOUNT_EMAIL,
    });
  }
}

// ── VIBE pricing tool (GeckoTerminal) ────────────────────────────────────────

const VIBE_POOL_URL =
  "https://api.geckoterminal.com/api/v2/networks/base/pools/0xc3ad498815597f1e6f71d3cb1166856e947efb46";

async function getVibePrice(args: { usd?: number; vibe?: number }): Promise<string> {
  try {
    const resp = await fetch(VIBE_POOL_URL, {
      headers: { "User-Agent": "VibeyBot/1.0", Accept: "application/json" },
    });
    if (!resp.ok) {
      return JSON.stringify({ ok: false, error: `GeckoTerminal ${resp.status}` });
    }
    const json = await resp.json();
    const attrs = json?.data?.attributes ?? {};
    const price = Number(attrs.base_token_price_usd);
    if (!isFinite(price) || price <= 0) {
      return JSON.stringify({ ok: false, error: "no price returned" });
    }
    const out: Record<string, unknown> = {
      ok: true,
      token: "VIBE",
      network: "base",
      contract: "0x7255ecf1020a95fed5323dd4feb23a54ab1aa7d1",
      price_usd: price,
      fdv_usd: Number(attrs.fdv_usd) || null,
      liquidity_usd: Number(attrs.reserve_in_usd) || null,
      volume_24h_usd: Number(attrs?.volume_usd?.h24) || null,
      price_change_24h_pct: Number(attrs?.price_change_percentage?.h24) || null,
      pool_name: attrs.name ?? null,
      source: "geckoterminal",
      // always-included reference stat: how much 1,000,000 VIBE is worth right now
      million_vibe_usd: price * 1_000_000,
    };
    if (typeof args?.usd === "number" && isFinite(args.usd)) {
      out.usd_input = args.usd;
      out.vibe_amount = args.usd / price;
    }
    if (typeof args?.vibe === "number" && isFinite(args.vibe)) {
      out.vibe_input = args.vibe;
      out.usd_amount = args.vibe * price;
    }
    return JSON.stringify(out);
  } catch (e) {
    return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

// ── Admin tool implementations ───────────────────────────────────────────────

async function adminUpdateSoul(
  supabase: SupabaseClient,
  args: { system_prompt?: string; model?: string; temperature?: number; max_tokens?: number }
): Promise<string> {
  const patch: Record<string, unknown> = {};
  if (typeof args.system_prompt === "string" && args.system_prompt.trim()) patch.system_prompt = args.system_prompt;
  if (typeof args.model === "string" && args.model.trim()) patch.model = args.model;
  if (typeof args.temperature === "number" && isFinite(args.temperature)) patch.temperature = args.temperature;
  if (typeof args.max_tokens === "number" && isFinite(args.max_tokens)) patch.max_tokens = Math.floor(args.max_tokens);
  if (Object.keys(patch).length === 0) {
    return JSON.stringify({ ok: false, error: "no fields to update" });
  }
  const { error } = await supabase.from("agents").update(patch).eq("id", VIBEY_AGENT_ID);
  if (error) return JSON.stringify({ ok: false, error: error.message });
  return JSON.stringify({ ok: true, updated: Object.keys(patch) });
}

async function adminDeleteMemory(supabase: SupabaseClient, args: { id: string }): Promise<string> {
  const id = (args?.id ?? "").trim();
  if (!id) return JSON.stringify({ ok: false, error: "id required" });
  const { data: existing } = await supabase
    .from("memories").select("id, content").eq("id", id).maybeSingle();
  if (!existing) return JSON.stringify({ ok: false, error: "memory not found" });
  const { error } = await supabase.from("memories").delete().eq("id", id);
  if (error) return JSON.stringify({ ok: false, error: error.message });
  return JSON.stringify({ ok: true, id, deleted_content: existing.content });
}

async function adminUpdateAnyMemory(
  supabase: SupabaseClient,
  args: { id: string; content: string; tags?: string[] }
): Promise<string> {
  const id = (args?.id ?? "").trim();
  const content = (args?.content ?? "").trim();
  if (!id || !content) return JSON.stringify({ ok: false, error: "id and content required" });
  const { data: existing } = await supabase
    .from("memories").select("id, content, tags").eq("id", id).maybeSingle();
  if (!existing) return JSON.stringify({ ok: false, error: "memory not found" });
  const patch: Record<string, unknown> = { content };
  if (Array.isArray(args.tags)) patch.tags = args.tags.filter((t) => typeof t === "string").slice(0, 6);
  const { error } = await supabase.from("memories").update(patch).eq("id", id);
  if (error) return JSON.stringify({ ok: false, error: error.message });
  return JSON.stringify({
    ok: true,
    id,
    before: { content: existing.content, tags: existing.tags },
    after: { content, tags: patch.tags ?? existing.tags },
  });
}

async function adminUpsertSkill(
  supabase: SupabaseClient,
  args: { name: string; label: string; description: string; prompt: string; category?: string; is_enabled?: boolean }
): Promise<string> {
  const name = (args?.name ?? "").trim().toLowerCase();
  if (!name) return JSON.stringify({ ok: false, error: "name required" });
  const row = {
    name,
    label: args.label,
    description: args.description,
    prompt: args.prompt,
    category: args.category || "general",
    is_enabled: args.is_enabled ?? true,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("agent_skills").upsert(row, { onConflict: "name" });
  if (error) return JSON.stringify({ ok: false, error: error.message });
  return JSON.stringify({ ok: true, name, is_enabled: row.is_enabled });
}

async function adminToggleSkill(
  supabase: SupabaseClient,
  args: { name: string; is_enabled: boolean }
): Promise<string> {
  const name = (args?.name ?? "").trim();
  if (!name) return JSON.stringify({ ok: false, error: "name required" });
  const { data, error } = await supabase
    .from("agent_skills").update({ is_enabled: args.is_enabled }).eq("name", name).select("name").maybeSingle();
  if (error) return JSON.stringify({ ok: false, error: error.message });
  if (!data) return JSON.stringify({ ok: false, error: `no skill named '${name}'` });
  return JSON.stringify({ ok: true, name, is_enabled: args.is_enabled });
}

async function adminToggleTool(
  supabase: SupabaseClient,
  args: { name: string; is_enabled: boolean }
): Promise<string> {
  const name = (args?.name ?? "").trim();
  if (!name) return JSON.stringify({ ok: false, error: "name required" });
  const builtIn = TOOLS.some((t) => t.function.name === name);
  if (!builtIn) return JSON.stringify({ ok: false, error: `'${name}' is not a known built-in tool` });
  // Upsert so the tool can be enabled even if the registry row doesn't exist yet.
  const { error } = await supabase
    .from("agent_tools")
    .upsert({ name, label: name, description: name, is_enabled: args.is_enabled, updated_at: new Date().toISOString() }, { onConflict: "name" });
  if (error) return JSON.stringify({ ok: false, error: error.message });
  return JSON.stringify({ ok: true, name, is_enabled: args.is_enabled });
}

const ADMIN_TOOL_NAMES = new Set(ADMIN_TOOLS.map((t) => t.function.name));

async function executeToolCall(
  supabase: SupabaseClient,
  call: NonNullable<ChatMessage["tool_calls"]>[number],
  metadata: Record<string, unknown>,
  callerVibeUserId: string | null = null,
  isAdmin: boolean = false
): Promise<string> {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(call.function.arguments || "{}");
  } catch {
    return JSON.stringify({ ok: false, error: "invalid JSON arguments" });
  }

  // Hard gate: admin tools require admin caller, even if the model tries to call one.
  if (ADMIN_TOOL_NAMES.has(call.function.name) && !isAdmin) {
    return JSON.stringify({ ok: false, error: "admin tools require admin access — refuse politely to the user" });
  }

  switch (call.function.name) {
    case "save_memory": {
      const result = await saveMemory(
        supabase,
        parsed as { content: string; tags?: string[] },
        metadata,
        callerVibeUserId
      );
      return JSON.stringify(result);
    }
    case "update_memory": {
      const result = await updateMemory(
        supabase,
        parsed as { id: string; content: string; tags?: string[] },
        callerVibeUserId
      );
      return JSON.stringify(result);
    }
    case "web_search":
      return await webSearch(parsed as { query: string; count?: number });
    case "fetch_url":
      return await fetchUrl(parsed as { url: string });
    case "granola_notes":
      return await fetchGranolaNotes(parsed as {
        query?: string;
        limit?: number;
        created_after?: string;
        created_before?: string;
      });
    case "get_vibe_price":
      return await getVibePrice(parsed as { usd?: number; vibe?: number });
    case "admin_update_soul":
      return await adminUpdateSoul(supabase, parsed as Parameters<typeof adminUpdateSoul>[1]);
    case "admin_delete_memory":
      return await adminDeleteMemory(supabase, parsed as { id: string });
    case "admin_update_any_memory":
      return await adminUpdateAnyMemory(supabase, parsed as Parameters<typeof adminUpdateAnyMemory>[1]);
    case "admin_upsert_skill":
      return await adminUpsertSkill(supabase, parsed as Parameters<typeof adminUpsertSkill>[1]);
    case "admin_toggle_skill":
      return await adminToggleSkill(supabase, parsed as { name: string; is_enabled: boolean });
    case "admin_toggle_tool":
      return await adminToggleTool(supabase, parsed as { name: string; is_enabled: boolean });
    default:
      return JSON.stringify({ ok: false, error: `unknown tool: ${call.function.name}` });
  }
}

// ── System prompt augmentation ───────────────────────────────────────────────

export function buildSystemPromptWithMemories(
  basePrompt: string,
  memories: Memory[],
  callerVibeUserId: string | null = null,
  isAdmin: boolean = false
): string {
  const memoryBlock =
    memories.length === 0
      ? "(none yet — feel free to call save_memory when something durable is worth remembering)"
      : memories
          .map((m, i) => {
            const tags = m.tags && m.tags.length ? ` [${m.tags.join(", ")}]` : "";
            const owner = m.created_by ?? "unknown";
            const mine =
              callerVibeUserId && m.created_by === callerVibeUserId ? " (yours)" : "";
            return `${i + 1}. id=${m.id} owner=${owner}${mine} — ${m.content}${tags}`;
          })
          .join("\n");

  const callerLine = callerVibeUserId
    ? `\nCurrent caller's vibe user id: ${callerVibeUserId}. You may update only memories where owner matches this id.`
    : `\nCurrent caller is anonymous (no vibe user id). You cannot update any memories for them.`;

  const toolsBlock = `
## Tools available

You have access to these tools:

- **save_memory(content, tags?)** — store a durable fact about the community for future conversations.
  Call it ONLY when the user shares something genuinely worth remembering long-term:
  community norms, recurring events, important projects/people, stated preferences.
  Do NOT save: small talk, jokes, ephemeral state, or things already in memory.
  Tags should be 1-4 short lowercase keywords.

- **update_memory(id, content, tags?)** — edit an existing memory.
  Pass the memory's UUID (shown as id=… in the list below) and the FULL new content.
  You can ONLY update memories where the owner matches the current caller's vibe user id
  (marked "(yours)" in the list). For anyone else's memory, refuse politely instead of calling.

- **web_search(query, count?)** — search the live web (Brave) for current info.
  Use for recent events, news, prices, dates, public facts you can't answer from memory.
  Returns titles + URLs + snippets. Follow up with fetch_url if you need full content.

- **fetch_url(url)** — fetch the readable text of a specific web page.
  Use after web_search, or when the user gives you a URL. Returns up to ~6000 chars of clean text.
  Don't use for social media or paywalled sites — won't work well.

- **granola_notes(query?, limit?, created_after?, created_before?)** — search meeting notes shared with
  Vibey's Granola account (${GRANOLA_ACCOUNT_EMAIL}).
  Use when the user asks about Granola notes, meeting/call/workshop context, decisions, action items,
  or says they sent/shared something to Vibey through Granola. Keep retrieved notes private to the
  current conversation; summarize only the relevant parts.

- **get_vibe_price(usd?, vibe?)** — fetch the LIVE price of VibeCoin (VIBE on Base) from GeckoTerminal.
  Call this ANY time the user mentions VIBE, VibeCoin, "vibes" as a token, sending VibeCoin,
  or asks "how many vibes is $X" / "what's my X VIBE worth" / "what's vibe at". NEVER answer
  VIBE pricing from memory — always call this tool. Pass \`usd\` to convert dollars→VIBE,
  or \`vibe\` to convert VIBE→dollars. Pool liquidity is thin (~\$60-70K), so flag that only
  when the user is talking about distribution or selling, not for simple lookups.
  The result always includes \`million_vibe_usd\` (what 1,000,000 VIBE is worth right now) —
  weave that in naturally as a fun reference stat when sharing the price.

You can call any tool zero, one, or multiple times before replying. After all tool
calls finish, give the user your normal natural-language reply — don't mention tools
by name unless they ask. When citing web info, ALWAYS include clickable markdown
links like [Edge Esmeralda](https://edgeesmeralda.com) — never bare domain names
("according to nytimes.com") and never bare URLs. Every external source you mention
should be a [label](url) link so the user can tap through.
${callerLine}

## Recent community memories (top ${memories.length})

${memoryBlock}
`.trim();

  const adminBlock = isAdmin
    ? `

## ADMIN POWERS (caller is a verified admin — Jack)

You are talking to one of your admins. They can edit YOU directly through conversation.
When they ask, use these admin tools (never expose them to non-admins):

- **admin_update_soul({ system_prompt?, model?, temperature?, max_tokens? })** — rewrite your live system prompt
  or change which model you run on. When updating the prompt, fetch / reason about the current one
  by inferring it from how you behave, then write the FULL new prompt (it replaces the existing one).
  Always read back to the admin a 1-2 sentence summary of what you changed and ask them to confirm
  it feels right.

- **admin_delete_memory({ id })** — permanently forget a memory. Use when admin says "forget X".

- **admin_update_any_memory({ id, content, tags? })** — edit any memory regardless of who created it.

- **admin_upsert_skill({ name, label, description, prompt, category?, is_enabled? })** — create or
  update a skill (a named playbook that gets injected into your prompt).

- **admin_toggle_skill({ name, is_enabled })** — turn a skill on or off.

- **admin_toggle_tool({ name, is_enabled })** — turn a built-in tool (web_search, fetch_url,
  granola_notes, get_vibe_price, save_memory, update_memory) on or off.

When an admin says things like "remember this differently", "change your tone", "stop using web search",
"add a skill for…", "you should be more X" — DO IT by calling the right admin tool, don't just say "ok".
After making a change, briefly confirm what you did. Treat admin edits as durable, immediate, and global —
they affect every future conversation with everyone, so if a request seems risky (e.g. wiping the soul),
ask one quick confirming question first.`
    : "";

  const formattingBlock = `

## Formatting your replies

Your messages get rendered with Markdown → Telegram HTML. Use these freely:
- **bold** with \`**text**\`
- *italic* with \`*text*\`
- \`inline code\` and triple-backtick code blocks
- **Hyperlinks**: ALWAYS use \`[label](https://url)\` syntax for any URL — never paste a bare URL when you have a name for it. Examples: \`[Granola](https://granola.ai)\`, \`[the venue map](https://maps.google.com/...)\`, \`[VibeCoin chart](https://geckoterminal.com/...)\`.
- Bullets with \`- \`

When a tool gives you a URL (web_search, fetch_url, get_vibe_price, etc.), wrap it in a Markdown link with a human-readable label rather than dumping the raw link.`;

  return `${basePrompt}\n\n${toolsBlock}${adminBlock}${formattingBlock}`;
}

// ── Identity resolution ──────────────────────────────────────────────────────

// Resolve a public.users.id from either a Supabase auth uid (web) or a Telegram
// identity (telegram_user_id, with fallback to telegram_username). Returns null
// if no Vibe profile can be linked. Used to build a unified `user:<id>` session
// key so the same conversation persists across web + Telegram.
export async function resolveVibeUserId(
  supabase: SupabaseClient,
  lookup: {
    auth_user_id?: string | null;
    telegram_user_id?: number | null;
    telegram_username?: string | null;
  }
): Promise<string | null> {
  if (lookup.auth_user_id) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", lookup.auth_user_id)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (lookup.telegram_user_id != null) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_user_id", lookup.telegram_user_id)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (lookup.telegram_username) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .ilike("telegram_username", lookup.telegram_username)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  return null;
}

export function unifiedSessionKey(vibeUserId: string | null, fallback: string): string {
  return vibeUserId ? `user:${vibeUserId}` : fallback;
}

// ── Per-user preferences ─────────────────────────────────────────────────────

export type UserPrefs = {
  display_name: string | null;
  telegram_username: string | null;
  telegram_user_id: number | null;
  relationship_notes: string | null;
  interaction_count: number | null;
  last_interaction_at: string | null;
};

export async function loadUserPreferences(
  supabase: SupabaseClient,
  lookup: { telegram_user_id?: number | null; telegram_username?: string | null }
): Promise<UserPrefs | null> {
  const tgId = lookup.telegram_user_id ?? null;
  const tgUser = lookup.telegram_username ?? null;
  if (tgId == null && !tgUser) return null;

  // Prefer match by telegram_user_id; fall back to username.
  if (tgId != null) {
    const { data } = await supabase
      .from("vibey_relationships")
      .select("display_name, telegram_username, telegram_user_id, relationship_notes, interaction_count, last_interaction_at")
      .eq("community_id", VIBEY_COMMUNITY_ID)
      .eq("telegram_user_id", tgId)
      .maybeSingle();
    if (data) return data as UserPrefs;
  }
  if (tgUser) {
    const { data } = await supabase
      .from("vibey_relationships")
      .select("display_name, telegram_username, telegram_user_id, relationship_notes, interaction_count, last_interaction_at")
      .eq("community_id", VIBEY_COMMUNITY_ID)
      .ilike("telegram_username", tgUser)
      .maybeSingle();
    if (data) return data as UserPrefs;
  }
  return null;
}

export function buildUserContextBlock(
  prefs: UserPrefs | null,
  fallback: { display_name?: string | null; telegram_username?: string | null }
): string {
  const name = prefs?.display_name || fallback.display_name || fallback.telegram_username || "this person";
  const handle = prefs?.telegram_username || fallback.telegram_username;
  const notes = prefs?.relationship_notes?.trim();

  const lines: string[] = [];
  lines.push(`## Who you're talking to right now`);
  lines.push(`- Name: ${name}${handle ? ` (@${handle})` : ""}`);
  if (prefs?.interaction_count) {
    lines.push(`- Past interactions with you: ${prefs.interaction_count}`);
  }
  if (notes) {
    lines.push(``);
    lines.push(`### Their preferences & context (admin-curated)`);
    lines.push(notes);
    lines.push(``);
    lines.push(`Use these preferences naturally — adapt tone, topics, and suggestions accordingly. Don't recite them back unprompted.`);
  } else {
    lines.push(`- No saved preferences yet for this person.`);
  }
  return lines.join("\n");
}

// ── Agent loop ───────────────────────────────────────────────────────────────
//
// Non-streaming variant. Returns the final assistant text. Used directly by
// telegram-webhook. The web chat function uses the lower-level pieces so it
// can stream the FINAL model call back to the browser.

const MAX_TOOL_ITERATIONS = 10;

export async function runAgentLoop(opts: {
  supabase: SupabaseClient;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  history: ChatMessage[]; // prior user/assistant turns
  userText: string;
  images?: ImageInput[]; // optional images to attach to the user turn (vision)
  toolMetadata?: Record<string, unknown>; // attached to any saved memories
  callerVibeUserId?: string | null;
  isAdmin?: boolean;
  referer?: string;
  title?: string;
}): Promise<string> {
  const {
    supabase,
    apiKey,
    model,
    temperature,
    maxTokens,
    systemPrompt,
    history,
    userText,
    images = [],
    toolMetadata = {},
    callerVibeUserId = null,
    isAdmin = false,
    referer = "https://community-vibes-ai.lovable.app",
    title = "Vibey",
  } = opts;

  const userContent: string | UserContentPart[] = images.length > 0
    ? [
        { type: "text", text: userText },
        ...images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: img.url, detail: img.detail ?? "auto" },
        })),
      ]
    : userText;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userContent },
  ];

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": title,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        stream: false,
        tools: filterTools(await loadEnabledToolNames(supabase), isAdmin),
        messages,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("OpenRouter error", resp.status, errText);
      return "";
    }

    const json = await resp.json();
    const choice = json?.choices?.[0]?.message;
    if (!choice) return "";

    const toolCalls = choice.tool_calls as ChatMessage["tool_calls"];

    if (!toolCalls || toolCalls.length === 0) {
      // Done — no more tool calls. Return the assistant text.
      return (choice.content ?? "").trim();
    }

    // Append the assistant's tool-call turn, then run each tool.
    messages.push({
      role: "assistant",
      content: choice.content ?? null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const result = await executeToolCall(supabase, call, toolMetadata, callerVibeUserId, isAdmin);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: result,
      });
    }
    // Loop back — model gets to see tool results and decide next step.
  }

  // Hit the iteration limit without a final reply. Force one last text-only
  // call so we always return something to the user.
  console.warn("runAgentLoop hit MAX_TOOL_ITERATIONS, forcing final reply");
  const finalResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": title,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      messages, // no tools this time
    }),
  });
  if (!finalResp.ok) return "";
  const finalJson = await finalResp.json();
  return (finalJson?.choices?.[0]?.message?.content ?? "").trim();
}

// ── Streaming variant for the web chat ───────────────────────────────────────
//
// Runs tool iterations, emitting playful `event: tool` SSE frames for each
// tool call (start + done), then pipes the final OpenRouter streaming response
// into the same stream. Returns a Response whose body is text/event-stream.

// Playful, human-readable labels for tool calls. Kept here so both the
// "starting" chip and the "done" chip stay consistent.
function describeToolStart(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "web_search": {
      const q = String(args?.query ?? "").trim();
      return q ? `🔎 googling "${q.slice(0, 80)}"…` : "🔎 searching the web…";
    }
    case "fetch_url": {
      const url = String(args?.url ?? "");
      let host = url;
      try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
      return `🌐 reading ${host}…`;
    }
    case "granola_notes": {
      const q = String(args?.query ?? "").trim();
      return q ? `📝 searching Granola for "${q.slice(0, 80)}"…` : "📝 checking Granola notes…";
    }
    case "save_memory":
      return "🧠 jotting this one down…";
    case "update_memory":
      return "✏️ rewriting that memory…";
    case "get_vibe_price": {
      const usd = args?.usd, vibe = args?.vibe;
      if (typeof usd === "number") return `🪙 checking VIBE for $${usd}…`;
      if (typeof vibe === "number") return `🪙 valuing ${Number(vibe).toLocaleString()} VIBE…`;
      return "🪙 fetching live VIBE price…";
    }
    default:
      return `⚙️ running ${name}…`;
  }
}

function describeToolDone(
  name: string,
  args: Record<string, unknown>,
  resultJson: string
): { label: string; details?: string } {
  let result: any = null;
  try { result = JSON.parse(resultJson); } catch { /* ignore */ }
  switch (name) {
    case "web_search": {
      const n = Array.isArray(result?.results) ? result.results.length : 0;
      if (result?.ok === false) return { label: `🤷 search hit a snag` };
      return { label: n > 0 ? `📡 found ${n} result${n === 1 ? "" : "s"}` : `🪨 nothing solid found` };
    }
    case "fetch_url": {
      if (result?.ok === false) return { label: `📭 couldn't read that page` };
      const url = String(args?.url ?? "");
      let host = url;
      try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
      return { label: `📖 read ${host}` };
    }
    case "granola_notes": {
      if (result?.ok === false) {
        return { label: `📝 Granola needs setup`, details: result?.error };
      }
      const n = Number(result?.count ?? 0);
      const email = result?.account_email ? ` from ${result.account_email}` : "";
      return {
        label: n > 0 ? `📝 found ${n} Granola note${n === 1 ? "" : "s"}` : `📝 no matching Granola notes`,
        details: `searched${email}`,
      };
    }
    case "save_memory":
      return { label: result?.ok ? `✨ memory saved` : `🤔 couldn't save that one` };
    case "update_memory": {
      if (result?.ok === false) {
        return { label: `🚫 couldn't update`, details: result?.error ?? undefined };
      }
      const before = result?.before?.content ?? "";
      const after = result?.after?.content ?? "";
      return {
        label: `📝 memory updated`,
        details: `before: ${before}\nafter:  ${after}`,
      };
    }
    case "get_vibe_price": {
      if (result?.ok === false) return { label: `🥲 couldn't fetch VIBE price`, details: result?.error };
      const p = Number(result?.price_usd);
      const priceStr = p ? `$${p.toFixed(10).replace(/0+$/, "0")}` : "—";
      const lines = [`price: ${priceStr}`];
      if (typeof result?.million_vibe_usd === "number") {
        lines.push(`1,000,000 VIBE = $${Math.round(result.million_vibe_usd).toLocaleString()}`);
      }
      if (typeof result?.vibe_amount === "number") {
        lines.push(`$${result.usd_input} = ${Math.round(result.vibe_amount).toLocaleString()} VIBE`);
      }
      if (typeof result?.usd_amount === "number") {
        lines.push(`${Number(result.vibe_input).toLocaleString()} VIBE = $${result.usd_amount.toFixed(4)}`);
      }
      return { label: `🪙 VIBE price fetched`, details: lines.join("\n") };
    }
    default:
      return { label: `✅ ${name} done` };
  }
}

export async function runAgentLoopStreaming(opts: {
  supabase: SupabaseClient;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  history: ChatMessage[];
  userText: string;
  toolMetadata?: Record<string, unknown>;
  callerVibeUserId?: string | null;
  isAdmin?: boolean;
  referer?: string;
  title?: string;
}): Promise<Response> {
  const {
    supabase,
    apiKey,
    model,
    temperature,
    maxTokens,
    systemPrompt,
    history,
    userText,
    toolMetadata = {},
    callerVibeUserId = null,
    isAdmin = false,
    referer = "https://community-vibes-ai.lovable.app",
    title = "Vibey",
  } = opts;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userText },
  ];

  const encoder = new TextEncoder();

  // We build a single ReadableStream that:
  //   1. Runs the tool loop, emitting `event: tool` frames as it goes.
  //   2. Pipes the final OpenRouter streaming response bytes through.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitTool = (payload: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: tool\ndata: ${JSON.stringify(payload)}\n\n`)
        );
      };

      try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": referer,
              "X-Title": title,
            },
            body: JSON.stringify({
              model,
              temperature,
              max_tokens: maxTokens,
              stream: false,
              tools: filterTools(await loadEnabledToolNames(supabase), isAdmin),
              messages,
            }),
          });

          if (!resp.ok) {
            const errText = await resp.text().catch(() => "");
            console.error("OpenRouter (probe) error", resp.status, errText);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: `OpenRouter ${resp.status}` })}\n\n`
              )
            );
            controller.close();
            return;
          }

          const json = await resp.json();
          const choice = json?.choices?.[0]?.message;
          const toolCalls = choice?.tool_calls as ChatMessage["tool_calls"];

          if (!toolCalls || toolCalls.length === 0) {
            // Done with tools — stream the final reply.
            const finalResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": referer,
                "X-Title": title,
              },
              body: JSON.stringify({
                model,
                temperature,
                max_tokens: maxTokens,
                stream: true,
                messages,
              }),
            });
            if (!finalResp.ok || !finalResp.body) {
              const errText = await finalResp.text().catch(() => "");
              console.error("final stream error", finalResp.status, errText);
              controller.close();
              return;
            }
            const reader = finalResp.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
            return;
          }

          // Run each tool, emitting start + done frames.
          messages.push({
            role: "assistant",
            content: choice.content ?? null,
            tool_calls: toolCalls,
          });

          for (const call of toolCalls) {
            let parsedArgs: Record<string, unknown> = {};
            try { parsedArgs = JSON.parse(call.function.arguments || "{}"); } catch { /* ignore */ }

            emitTool({
              id: call.id,
              name: call.function.name,
              status: "start",
              label: describeToolStart(call.function.name, parsedArgs),
              args: parsedArgs,
            });

            const result = await executeToolCall(supabase, call, toolMetadata, callerVibeUserId, isAdmin);

            const done = describeToolDone(call.function.name, parsedArgs, result);
            emitTool({
              id: call.id,
              name: call.function.name,
              status: "done",
              label: done.label,
              details: done.details,
            });

            messages.push({
              role: "tool",
              tool_call_id: call.id,
              name: call.function.name,
              content: result,
            });
          }
        }

        // Iteration cap — force a final streaming reply with no tools.
        const finalResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": referer,
            "X-Title": title,
          },
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: maxTokens,
            stream: true,
            messages,
          }),
        });
        if (finalResp.ok && finalResp.body) {
          const reader = finalResp.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
        controller.close();
      } catch (e) {
        console.error("runAgentLoopStreaming error:", e);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}
