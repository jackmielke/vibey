// Edge function: Telegram webhook for Vibey.
// - Receives updates from Telegram (private DMs only in v1).
// - Loads Vibey's soul + config from the agents row (single source of truth).
// - Calls OpenRouter non-streaming (Telegram wants one reply, not a stream).
// - Sends the reply back via Telegram sendMessage API.
// - Logs the exchange to agent_chat_logs with session_key=telegram:<chat_id>.
//
// v1 scope (deliberately minimal):
// - Private chats only. Groups and channels are ignored silently.
// - No history hydration yet — Vibey replies from the single incoming message
//   plus the system prompt. Per-user memory comes later.
// - No secret-token header check. Add TELEGRAM_WEBHOOK_SECRET validation
//   in v2 as hardening.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
};

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

async function tg(token: string, method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`Telegram ${method} failed`, res.status, errText);
  }
  return res;
}

Deno.serve(async (req) => {
  // Always return 200 quickly so Telegram doesn't retry. We do the work inside.
  // If anything throws we still 200 — retries would double-reply and feel weird.
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!TELEGRAM_BOT_TOKEN || !OPENROUTER_API_KEY) {
    console.error("Missing TELEGRAM_BOT_TOKEN or OPENROUTER_API_KEY");
    return new Response("missing secrets", { status: 200 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  const msg = update.message ?? update.edited_message;
  if (!msg || !msg.text) {
    return new Response("ok", { status: 200 });
  }

  // v1: private chats only. Silently ignore groups/channels for now.
  if (msg.chat.type !== "private") {
    return new Response("ok", { status: 200 });
  }

  const chatId = msg.chat.id;
  const userId = msg.from?.id ?? chatId;
  const username = msg.from?.username ?? msg.from?.first_name ?? "unknown";
  const userText = msg.text.trim();

  // Typing indicator while we think — gives the chat a "real" feel.
  await tg(TELEGRAM_BOT_TOKEN, "sendChatAction", {
    chat_id: chatId,
    action: "typing",
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Load Vibey's soul + config.
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("system_prompt, model, temperature, max_tokens, name")
    .eq("id", VIBEY_AGENT_ID)
    .maybeSingle();

  if (agentError || !agent) {
    console.error("Vibey agent not found", agentError);
    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: "something's off on my end — try again in a minute",
    });
    return new Response("ok", { status: 200 });
  }

  // Call OpenRouter non-streaming. Telegram wants one message, not a stream.
  const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://t.me/vibey_ai_bot",
      "X-Title": "Vibey (Telegram)",
    },
    body: JSON.stringify({
      model: agent.model,
      temperature: agent.temperature ?? 0.7,
      max_tokens: agent.max_tokens ?? 2048,
      stream: false,
      messages: [
        { role: "system", content: agent.system_prompt },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!orResponse.ok) {
    const errText = await orResponse.text().catch(() => "");
    console.error("OpenRouter error", orResponse.status, errText);
    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: "my brain's having a moment. try again?",
    });
    return new Response("ok", { status: 200 });
  }

  const orJson = await orResponse.json();
  const reply: string = orJson?.choices?.[0]?.message?.content?.trim() ?? "";
  const tokensUsed: number | null = orJson?.usage?.total_tokens ?? null;

  if (!reply) {
    console.error("Empty reply from OpenRouter", orJson);
    return new Response("ok", { status: 200 });
  }

  // Send the reply. Telegram messages cap at 4096 chars; soul tells Vibey to
  // keep it short anyway, but truncate defensively.
  const body = reply.length > 4000 ? reply.slice(0, 3997) + "..." : reply;
  await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
    chat_id: chatId,
    text: body,
  });

  // Log (fire-and-forget is fine — we already replied).
  supabase
    .from("agent_chat_logs")
    .insert({
      agent_id: VIBEY_AGENT_ID,
      community_id: VIBEY_COMMUNITY_ID,
      user_message: userText,
      agent_response: body,
      tokens_used: tokensUsed,
      session_key: `telegram:${chatId}`,
      telegram_chat_id: chatId,
      telegram_user_id: userId,
      telegram_username: username,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error("Failed to log telegram chat:", error);
    });

  return new Response("ok", { status: 200 });
});
