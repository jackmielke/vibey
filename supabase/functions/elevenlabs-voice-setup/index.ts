// Lazy-provision an ElevenLabs Conversational AI agent for Vibey, then mint a
// short-lived WebRTC conversation token the browser can use with @elevenlabs/react.
//
// First call: creates the agent over there, stores its id on agents.elevenlabs_agent_id.
// Every call: refreshes Vibey's soul on the agent (so prompt edits propagate),
// then returns { token, agent_id }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

// Default voice — Sarah. User can swap via ElevenLabs dashboard later.
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

async function elevenFetch(path: string, apiKey: string, init: RequestInit = {}) {
  return fetch(`${ELEVEN_BASE}${path}`, {
    ...init,
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function createAgent(apiKey: string, prompt: string, firstMessage: string, name: string) {
  const resp = await elevenFetch("/convai/agents/create", apiKey, {
    method: "POST",
    body: JSON.stringify({
      name,
      conversation_config: {
        agent: {
          prompt: { prompt },
          first_message: firstMessage,
          language: "en",
        },
        tts: {
          voice_id: DEFAULT_VOICE_ID,
        },
      },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`create agent failed (${resp.status}): ${txt}`);
  }
  const json = await resp.json();
  return json.agent_id as string;
}

async function updateAgent(apiKey: string, agentId: string, prompt: string, firstMessage: string) {
  const resp = await elevenFetch(`/convai/agents/${agentId}`, apiKey, {
    method: "PATCH",
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: { prompt },
          first_message: firstMessage,
          language: "en",
        },
      },
    }),
  });
  // Don't throw on update failure — keep going, the agent still exists.
  if (!resp.ok) {
    console.warn("update agent non-fatal:", resp.status, await resp.text().catch(() => ""));
  }
}

async function getConversationToken(apiKey: string, agentId: string): Promise<string> {
  const resp = await fetch(
    `${ELEVEN_BASE}/convai/conversation/token?agent_id=${agentId}`,
    { headers: { "xi-api-key": apiKey } }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`token request failed (${resp.status}): ${txt}`);
  }
  const json = await resp.json();
  return json.token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load Vibey row
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("id, name, system_prompt, intro_message, elevenlabs_agent_id")
      .eq("id", VIBEY_AGENT_ID)
      .maybeSingle();

    if (agentErr || !agent) {
      throw new Error(`could not load Vibey: ${agentErr?.message ?? "not found"}`);
    }

    // Voice prompt — use the soul, but tell it to keep replies short for voice.
    const voicePrompt = `${agent.system_prompt}

## Voice mode

You're talking out loud right now. Keep replies conversational and concise — usually 1-3 sentences, never long monologues. No markdown, no lists, no code blocks. If the person asks for something long, give them the gist and offer to send details in chat.`;

    const firstMessage =
      agent.intro_message?.trim() ||
      `Hey, it's ${agent.name}. What's on your mind?`;

    let agentId = agent.elevenlabs_agent_id as string | null;

    if (!agentId) {
      agentId = await createAgent(apiKey, voicePrompt, firstMessage, agent.name);
      const { error: updErr } = await supabase
        .from("agents")
        .update({ elevenlabs_agent_id: agentId })
        .eq("id", VIBEY_AGENT_ID);
      if (updErr) console.warn("could not store agent id:", updErr.message);
    } else {
      // Sync soul changes up to ElevenLabs every time.
      await updateAgent(apiKey, agentId, voicePrompt, firstMessage);
    }

    const token = await getConversationToken(apiKey, agentId);

    return new Response(
      JSON.stringify({ token, agent_id: agentId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("voice-setup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
