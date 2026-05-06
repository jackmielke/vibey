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

// Auto-load this many recent memories into the system prompt every turn.
// (We can swap this for a `recall_memories` tool later when the corpus grows.)
export const MEMORY_PRELOAD_LIMIT = 50;

export type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
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
];

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

async function executeToolCall(
  supabase: SupabaseClient,
  call: NonNullable<ChatMessage["tool_calls"]>[number],
  metadata: Record<string, unknown>,
  callerVibeUserId: string | null = null
): Promise<string> {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(call.function.arguments || "{}");
  } catch {
    return JSON.stringify({ ok: false, error: "invalid JSON arguments" });
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
    case "get_vibe_price":
      return await getVibePrice(parsed as { usd?: number; vibe?: number });
    default:
      return JSON.stringify({ ok: false, error: `unknown tool: ${call.function.name}` });
  }
}

// ── System prompt augmentation ───────────────────────────────────────────────

export function buildSystemPromptWithMemories(
  basePrompt: string,
  memories: Memory[],
  callerVibeUserId: string | null = null
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
by name unless they ask. When citing web info, mention the source naturally
("According to nytimes.com…").
${callerLine}

## Recent community memories (top ${memories.length})

${memoryBlock}
`.trim();

  return `${basePrompt}\n\n${toolsBlock}`;
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

const MAX_TOOL_ITERATIONS = 4;

export async function runAgentLoop(opts: {
  supabase: SupabaseClient;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  history: ChatMessage[]; // prior user/assistant turns
  userText: string;
  toolMetadata?: Record<string, unknown>; // attached to any saved memories
  callerVibeUserId?: string | null;
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
    toolMetadata = {},
    callerVibeUserId = null,
    referer = "https://community-vibes-ai.lovable.app",
    title = "Vibey",
  } = opts;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userText },
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
        tools: TOOLS,
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
      const result = await executeToolCall(supabase, call, toolMetadata, callerVibeUserId);
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
              tools: TOOLS,
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

            const result = await executeToolCall(supabase, call, toolMetadata, callerVibeUserId);

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
