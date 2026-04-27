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
    .select("id, content, tags, created_at, metadata")
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
  metadata: Record<string, unknown> = {}
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
      // created_by stays null — Telegram callers aren't auth.users.
    })
    .select("id")
    .single();

  if (error) {
    console.error("save_memory failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id };
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

// ── Tool dispatch ────────────────────────────────────────────────────────────

async function executeToolCall(
  supabase: SupabaseClient,
  call: NonNullable<ChatMessage["tool_calls"]>[number],
  metadata: Record<string, unknown>
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
        metadata
      );
      return JSON.stringify(result);
    }
    case "web_search":
      return await webSearch(parsed as { query: string; count?: number });
    case "fetch_url":
      return await fetchUrl(parsed as { url: string });
    default:
      return JSON.stringify({ ok: false, error: `unknown tool: ${call.function.name}` });
  }
}

// ── System prompt augmentation ───────────────────────────────────────────────

export function buildSystemPromptWithMemories(
  basePrompt: string,
  memories: Memory[]
): string {
  const memoryBlock =
    memories.length === 0
      ? "(none yet — feel free to call save_memory when something durable is worth remembering)"
      : memories
          .map((m, i) => {
            const tags = m.tags && m.tags.length ? ` [${m.tags.join(", ")}]` : "";
            return `${i + 1}. ${m.content}${tags}`;
          })
          .join("\n");

  const toolsBlock = `
## Tools available

You have access to these tools:

- **save_memory(content, tags?)** — store a durable fact about the community for future conversations.
  Call it ONLY when the user shares something genuinely worth remembering long-term:
  community norms, recurring events, important projects/people, stated preferences.
  Do NOT save: small talk, jokes, ephemeral state, or things already in memory.
  Tags should be 1-4 short lowercase keywords.

- **web_search(query, count?)** — search the live web (Brave) for current info.
  Use for recent events, news, prices, dates, public facts you can't answer from memory.
  Returns titles + URLs + snippets. Follow up with fetch_url if you need full content.

- **fetch_url(url)** — fetch the readable text of a specific web page.
  Use after web_search, or when the user gives you a URL. Returns up to ~6000 chars of clean text.
  Don't use for social media or paywalled sites — won't work well.

You can call any tool zero, one, or multiple times before replying. After all tool
calls finish, give the user your normal natural-language reply — don't mention tools
by name unless they ask. When citing web info, mention the source naturally
("According to nytimes.com…").

## Recent community memories (top ${memories.length})

${memoryBlock}
`.trim();

  return `${basePrompt}\n\n${toolsBlock}`;
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
      const result = await executeToolCall(supabase, call, toolMetadata);
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
// Runs tool iterations non-streaming, then issues the FINAL model call with
// stream:true and returns the raw Response so the caller can pipe SSE bytes
// to the browser. This keeps the existing chat-with-vibey streaming UX.

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
      console.error("OpenRouter (probe) error", resp.status, await resp.text());
      return resp;
    }

    const json = await resp.json();
    const choice = json?.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls as ChatMessage["tool_calls"];

    if (!toolCalls || toolCalls.length === 0) {
      // No tools needed — issue the streaming call now. We could return the
      // already-fetched text, but streaming gives a nicer UX and keeps the
      // existing SSE wiring untouched. Cost: one extra cheap round-trip.
      return await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
          messages, // no tools — we already know the model is done
        }),
      });
    }

    // Run the tools, then loop.
    messages.push({
      role: "assistant",
      content: choice.content ?? null,
      tool_calls: toolCalls,
    });
    for (const call of toolCalls) {
      const result = await executeToolCall(supabase, call, toolMetadata);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: result,
      });
    }
  }

  // Iteration cap reached — force a streaming reply with no tools.
  return await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
}
