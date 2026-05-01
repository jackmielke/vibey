// Edge function: streams chat completions from OpenRouter on behalf of Vibey.
// - Loads the global Vibey agent row to get system_prompt + model + sampling params.
// - Forwards conversation history to OpenRouter (OpenAI-compatible API).
// - Streams SSE back to the client untouched.
// - Hybrid image search: keyword pre-filter on gallery_photos, then Claude picks
//   the best 1-3 matches. Chosen images are sent to the client as a custom SSE
//   event ("event: images") AFTER the assistant text stream completes.
// - On completion, persists the user/assistant pair to agent_chat_logs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildSystemPromptWithMemories,
  buildUserContextBlock,
  loadRecentMemories,
  loadUserPreferences,
  runAgentLoopStreaming,
} from "../_shared/vibey-agent.ts";

const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type CallerContext = {
  surface?: "web" | "telegram" | "x" | "robot" | string;
  external_id?: string;
  external_handle?: string;
};

type GalleryPhoto = {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  residency_name: string | null;
};

function buildSessionKey(ctx: CallerContext | undefined): string {
  const surface = ctx?.surface || "web";
  const id = ctx?.external_id || "anon";
  return `${surface}:${id}`;
}

// Pull keyword candidates from gallery_photos using ILIKE on title/description/
// residency_name + array overlap on tags. Cheap and good enough as a pre-filter.
// deno-lint-ignore no-explicit-any
async function fetchCandidatePhotos(
  supabase: any,
  query: string
): Promise<GalleryPhoto[]> {
  const tokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 6);

  if (tokens.length === 0) return [];

  // Build an OR filter: title.ilike.%t%,description.ilike.%t%,residency_name.ilike.%t%
  // for each token, plus tags array overlap.
  const orParts: string[] = [];
  for (const t of tokens) {
    const safe = t.replace(/[%,()]/g, "");
    orParts.push(`title.ilike.%${safe}%`);
    orParts.push(`description.ilike.%${safe}%`);
    orParts.push(`residency_name.ilike.%${safe}%`);
  }

  const { data, error } = await supabase
    .from("gallery_photos")
    .select("id, image_url, title, description, tags, residency_name")
    .eq("is_visible", true)
    .or(orParts.join(","))
    .limit(20);

  if (error) {
    console.error("gallery keyword search failed:", error.message);
    return [];
  }

  // Also try tag overlap as a separate query (Supabase doesn't mix .or with .overlaps cleanly)
  const { data: tagData } = await supabase
    .from("gallery_photos")
    .select("id, image_url, title, description, tags, residency_name")
    .eq("is_visible", true)
    .overlaps("tags", tokens)
    .limit(20);

  const merged = new Map<string, GalleryPhoto>();
  for (const row of [...(data ?? []), ...(tagData ?? [])]) {
    merged.set((row as GalleryPhoto).id, row as GalleryPhoto);
  }
  return Array.from(merged.values()).slice(0, 20);
}

// Ask Claude (cheap call, non-streaming) to pick 0-3 best matching photo IDs.
// Returns the picked photos in display order, or [] if none are a good fit.
async function pickPhotosWithLLM(
  apiKey: string,
  model: string,
  userQuery: string,
  candidates: GalleryPhoto[]
): Promise<GalleryPhoto[]> {
  if (candidates.length === 0) return [];

  const compact = candidates.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description?.slice(0, 200) ?? null,
    tags: p.tags,
    residency: p.residency_name,
  }));

  const system =
    "You are an image curator. Given a user's request and a list of candidate photos (with titles, descriptions, tags), return ONLY a JSON object {\"ids\": [\"uuid\", ...]} with the 1-3 best matches in order of relevance. If NONE clearly match the user's request, return {\"ids\": []}. Never invent IDs. Never include explanation.";

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://community-vibes-ai.lovable.app",
      "X-Title": "Vibey image picker",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `User asked: "${userQuery}"\n\nCandidates:\n${JSON.stringify(compact)}`,
        },
      ],
    }),
  });

  if (!resp.ok) {
    console.error("photo picker LLM failed:", resp.status, await resp.text());
    return [];
  }

  try {
    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const ids: string[] = Array.isArray(parsed?.ids) ? parsed.ids.slice(0, 3) : [];
    const byId = new Map(candidates.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as GalleryPhoto[];
  } catch (e) {
    console.error("photo picker parse failed:", e);
    return [];
  }
}

// Heuristic: only run image search when the user's message smells image-y.
function looksImageRequest(text: string): boolean {
  return /\b(photo|photos|picture|pictures|image|images|show|see|gallery|look|visual|pic|pics)\b/i.test(
    text
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const context: CallerContext | undefined = body?.context && typeof body.context === "object"
      ? body.context
      : undefined;
    const sessionKey = buildSessionKey(context);
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load Vibey config
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("system_prompt, model, temperature, max_tokens, name")
      .eq("id", VIBEY_AGENT_ID)
      .maybeSingle();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Vibey agent not found", details: agentError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // Kick off image search in parallel with the chat call. We won't block the
    // text stream on it — we'll append the result as a final SSE event.
    const imageSearchPromise: Promise<GalleryPhoto[]> = looksImageRequest(lastUserMessage)
      ? (async () => {
          const candidates = await fetchCandidatePhotos(supabase, lastUserMessage);
          if (candidates.length === 0) return [];
          return pickPhotosWithLLM(OPENROUTER_API_KEY, agent.model, lastUserMessage, candidates);
        })()
      : Promise.resolve([]);

    // Augment system prompt with: image-handling note + recent community memories.
    const memories = await loadRecentMemories(supabase);
    const baseSystemPrompt =
      `${agent.system_prompt}\n\nNote: when the user asks to see photos/images, the app will attach matching gallery images below your reply automatically. Just speak naturally about them — do NOT paste image URLs or markdown image syntax.`;
    const systemPrompt = buildSystemPromptWithMemories(baseSystemPrompt, memories);

    // Split incoming messages into prior history + the current user turn so the
    // agent loop can run tool iterations before streaming the final reply.
    const lastUserIdx = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") return i;
      }
      return -1;
    })();
    const history = lastUserIdx >= 0 ? messages.slice(0, lastUserIdx) : messages;
    const userText = lastUserIdx >= 0 ? messages[lastUserIdx].content : "";

    const orResponse = await runAgentLoopStreaming({
      supabase,
      apiKey: OPENROUTER_API_KEY,
      model: agent.model,
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.max_tokens ?? 2048,
      systemPrompt,
      history,
      userText,
      toolMetadata: {
        source: context?.surface ?? "web",
        external_id: context?.external_id ?? null,
        external_handle: context?.external_handle ?? null,
      },
    });

    if (!orResponse.ok || !orResponse.body) {
      const errText = await orResponse.text();
      console.error("OpenRouter error", orResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `OpenRouter error (${orResponse.status})`, details: errText }),
        { status: orResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tee the OpenRouter stream: one copy passes through to the client (after
    // we wrap it so we can append the images event), the other accumulates for logging.
    const [orForClient, orForLog] = orResponse.body.tee();

    // Build a wrapped stream: pipe OR bytes through, then append `event: images\ndata: ...\n\n`.
    const encoder = new TextEncoder();
    const wrapped = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = orForClient.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          // After OR finishes streaming, await the image search and emit it.
          let picked: GalleryPhoto[] = [];
          try {
            picked = await imageSearchPromise;
          } catch (e) {
            console.error("image search failed:", e);
          }
          const payload = JSON.stringify(
            picked.map((p) => ({
              id: p.id,
              url: p.image_url,
              title: p.title,
              description: p.description,
            }))
          );
          controller.enqueue(encoder.encode(`event: images\ndata: ${payload}\n\n`));
        } catch (e) {
          console.error("stream wrap error:", e);
        } finally {
          controller.close();
        }
      },
    });

    // Background: read logStream, accumulate full assistant text, persist to agent_chat_logs.
    (async () => {
      try {
        const reader = orForLog.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";
        let totalTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string") assistantText += delta;
              const usage = parsed?.usage?.total_tokens;
              if (typeof usage === "number") totalTokens = usage;
            } catch {
              // partial JSON across chunks — ignore for logging
            }
          }
        }

        if (assistantText && lastUserMessage) {
          await supabase.from("agent_chat_logs").insert({
            agent_id: VIBEY_AGENT_ID,
            community_id: VIBEY_COMMUNITY_ID,
            user_message: lastUserMessage,
            agent_response: assistantText,
            tokens_used: totalTokens || null,
            session_key: sessionKey,
          });
        }
      } catch (e) {
        console.error("Failed to log chat:", e);
      }
    })();

    return new Response(wrapped, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-with-vibey error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
