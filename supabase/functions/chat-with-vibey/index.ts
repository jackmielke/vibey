// Edge function: streams chat completions from OpenRouter on behalf of Vibey.
// - Loads the global Vibey agent row to get system_prompt + model + sampling params.
// - Forwards conversation history to OpenRouter (OpenAI-compatible API).
// - Streams SSE back to the client untouched.
// - On completion, persists the user/assistant pair to agent_chat_logs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

// Optional surface-aware context so every interface (website, telegram, x, robot)
// can hit this same endpoint without reinventing wheels. Backward compatible:
// if omitted, we treat the caller as anonymous web.
type CallerContext = {
  surface?: "web" | "telegram" | "x" | "robot" | string;
  external_id?: string; // telegram user id, x handle, etc.
  external_handle?: string; // display name / username when available
};

function buildSessionKey(ctx: CallerContext | undefined): string {
  const surface = ctx?.surface || "web";
  const id = ctx?.external_id || "anon";
  return `${surface}:${id}`;
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

    const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://community-vibes-ai.lovable.app",
        "X-Title": "Vibey",
      },
      body: JSON.stringify({
        model: agent.model,
        temperature: agent.temperature ?? 0.7,
        max_tokens: agent.max_tokens ?? 2048,
        stream: true,
        messages: [
          { role: "system", content: agent.system_prompt },
          ...messages,
        ],
      }),
    });

    if (!orResponse.ok || !orResponse.body) {
      const errText = await orResponse.text();
      console.error("OpenRouter error", orResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `OpenRouter error (${orResponse.status})`, details: errText }),
        { status: orResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tee the stream: pipe one copy to the client, accumulate the other for logging.
    const [clientStream, logStream] = orResponse.body.tee();

    // Background: read logStream, accumulate full assistant text, persist to agent_chat_logs.
    (async () => {
      try {
        const reader = logStream.getReader();
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

    return new Response(clientStream, {
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
