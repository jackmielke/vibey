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

You have access to one tool:

- **save_memory(content, tags?)** — store a durable fact about the community for future conversations.
  Call it ONLY when the user shares something genuinely worth remembering long-term:
  community norms, recurring events, important projects/people, stated preferences.
  Do NOT save: small talk, jokes, ephemeral state, or things already in memory.
  Tags should be 1-4 short lowercase keywords.

You can call save_memory zero, one, or multiple times before replying. After all tool
calls finish, give the user your normal natural-language reply — do not mention the
tool by name unless they ask.

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
