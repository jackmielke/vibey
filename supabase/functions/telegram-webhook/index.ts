// Edge function: Telegram webhook for Vibey — v2
//
// Behaviour by chat type:
//   private   → always respond (same as v1)
//   group / supergroup →
//     - Vibey joins silently (no response by default)
//     - Upserts the group into telegram_group_settings on first contact
//     - "/vibey on"  → enables the group, Vibey introduces itself
//     - "/vibey off" → disables the group, Vibey says goodbye
//     - While disabled: log the message, return silently
//     - While enabled: respond ONLY when @mentioned or when replying to Vibey
//
// History: last 10 exchanges from agent_chat_logs are hydrated as context.
//
// TODO (v3): webhook secret-token validation header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildSystemPromptWithMemories,
  buildUserContextBlock,
  loadRecentMemories,
  loadUserPreferences,
  runAgentLoop,
} from "../_shared/vibey-agent.ts";

const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const BOT_USERNAME = "vibey_ai_bot"; // without @

// ── Telegram types ────────────────────────────────────────────────────────────

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

type TelegramVoice = {
  file_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
};

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  voice?: TelegramVoice;
  audio?: TelegramVoice;
  reply_to_message?: TelegramMessage;
  entities?: Array<{ type: string; offset: number; length: number }>;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

// ── Telegram API helper ───────────────────────────────────────────────────────

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

// ── Voice transcription via OpenAI Whisper ────────────────────────────────────

async function transcribeVoice(
  botToken: string,
  openaiKey: string,
  fileId: string
): Promise<string | null> {
  try {
    const fileResp = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const fileJson = await fileResp.json();
    const filePath = fileJson?.result?.file_path;
    if (!filePath) {
      console.error("getFile returned no file_path", fileJson);
      return null;
    }

    const audioResp = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`
    );
    if (!audioResp.ok) {
      console.error("audio download failed", audioResp.status);
      return null;
    }
    const audioBlob = await audioResp.blob();

    const form = new FormData();
    const filename = filePath.split("/").pop() || "voice.oga";
    form.append("file", audioBlob, filename);
    form.append("model", "whisper-1");

    const whisperResp = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      }
    );

    if (!whisperResp.ok) {
      const errText = await whisperResp.text().catch(() => "");
      console.error("whisper failed", whisperResp.status, errText);
      return null;
    }

    const json = await whisperResp.json();
    const text = (json?.text ?? "").trim();
    return text || null;
  } catch (e) {
    console.error("transcribeVoice threw:", e);
    return null;
  }
}

// ── Mention detection ─────────────────────────────────────────────────────────

function isMentioned(msg: TelegramMessage): boolean {
  if (!msg.text) return false;
  // Check for @botusername in message text (case-insensitive)
  if (msg.text.toLowerCase().includes(`@${BOT_USERNAME.toLowerCase()}`)) return true;
  // Check entities for mention type
  if (msg.entities) {
    for (const entity of msg.entities) {
      if (entity.type === "mention") {
        const mention = msg.text.slice(entity.offset, entity.offset + entity.length);
        if (mention.toLowerCase() === `@${BOT_USERNAME.toLowerCase()}`) return true;
      }
    }
  }
  return false;
}

function isReplyToBot(msg: TelegramMessage): boolean {
  return !!msg.reply_to_message?.from?.is_bot &&
    msg.reply_to_message?.from?.username?.toLowerCase() === BOT_USERNAME.toLowerCase();
}

function isVibeyCommand(text: string | undefined, command: string): boolean {
  if (!text) return false;
  const lower = text.trim().toLowerCase();
  // Match "/vibey on", "/vibey on@vibey_ai_bot", etc.
  return lower === `/vibey ${command}` ||
    lower.startsWith(`/vibey ${command}@`);
}

// ── History hydration ─────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function loadHistory(
  supabase: any,
  sessionKey: string,
  limit = 10
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const { data, error } = await supabase
    .from("agent_chat_logs")
    .select("user_message, agent_response")
    .eq("session_key", sessionKey)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Reverse so oldest is first, then flatten into user/assistant pairs
  return (data as Array<{ user_message: string; agent_response: string }>)
    .reverse()
    .flatMap((row) => [
      { role: "user" as const, content: row.user_message },
      { role: "assistant" as const, content: row.agent_response },
    ]);
}

// (OpenRouter is called via runAgentLoop in _shared/vibey-agent.ts)

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Always 200 — Telegram retries on non-200, which causes double replies.
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!TELEGRAM_BOT_TOKEN || !OPENROUTER_API_KEY) {
    console.error("Missing TELEGRAM_BOT_TOKEN or OPENROUTER_API_KEY");
    return new Response("ok", { status: 200 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  const msg = update.message ?? update.edited_message;
  if (!msg) return new Response("ok", { status: 200 });

  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  const userId = msg.from?.id ?? chatId;
  const username = msg.from?.username ?? msg.from?.first_name ?? "unknown";
  const isGroup = chatType === "group" || chatType === "supergroup";
  const sessionKey = `telegram:${chatId}`;

  // Resolve the user's text — either raw text, or transcribed voice/audio.
  let userText = (msg.text ?? "").trim();
  let wasVoice = false;

  if (!userText && (msg.voice || msg.audio)) {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("Voice received but OPENAI_API_KEY not configured");
      await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "i can't transcribe voice notes yet — text me instead 🙏",
      });
      return new Response("ok", { status: 200 });
    }

    // Show "recording" feedback while we transcribe.
    await tg(TELEGRAM_BOT_TOKEN, "sendChatAction", {
      chat_id: chatId,
      action: "typing",
    });

    const fileId = (msg.voice ?? msg.audio)!.file_id;
    const transcript = await transcribeVoice(TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, fileId);

    if (!transcript) {
      await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "couldn't catch that — mind sending it again or typing it out?",
        reply_to_message_id: msg.message_id,
      });
      return new Response("ok", { status: 200 });
    }

    userText = transcript;
    wasVoice = true;

    // Echo back what we heard so the user can confirm.
    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: `🎙️ <i>${transcript.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</i>`,
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id,
    });
  }

  // No text and no voice — nothing to do.
  if (!userText) return new Response("ok", { status: 200 });


  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Group chat: opt-in logic ──────────────────────────────────────────────

  if (isGroup) {
    // Upsert group record (silent — just tracks that Vibey is in this chat).
    await supabase.from("telegram_group_settings").upsert(
      {
        chat_id: chatId,
        chat_title: msg.chat.title ?? null,
        bot_username: BOT_USERNAME,
        added_at: new Date().toISOString(),
      },
      { onConflict: "chat_id", ignoreDuplicates: true }
    );

    // Handle "/vibey on" — enable this group.
    if (isVibeyCommand(userText, "on")) {
      await supabase.from("telegram_group_settings").update({
        enabled: true,
        enabled_at: new Date().toISOString(),
        enabled_by: username,
        disabled_at: null,
      }).eq("chat_id", chatId);

      await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "hey everyone 👋 vibey here. i'll be hanging out in this chat now — just @ me when you want to chat.",
        reply_to_message_id: msg.message_id,
      });
      return new Response("ok", { status: 200 });
    }

    // Handle "/vibey off" — disable this group.
    if (isVibeyCommand(userText, "off")) {
      await supabase.from("telegram_group_settings").update({
        enabled: false,
        disabled_at: new Date().toISOString(),
      }).eq("chat_id", chatId);

      await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "going quiet. ping me with /vibey on whenever you want me back 🌀",
        reply_to_message_id: msg.message_id,
      });
      return new Response("ok", { status: 200 });
    }

    // Check if this group is enabled.
    const { data: groupSettings } = await supabase
      .from("telegram_group_settings")
      .select("enabled")
      .eq("chat_id", chatId)
      .maybeSingle();

    const enabled = groupSettings?.enabled ?? false;

    // Not enabled and not a command — log silently and bail.
    if (!enabled) {
      console.log(`Group ${chatId} not enabled — silent mode`);
      return new Response("ok", { status: 200 });
    }

    // Enabled: only respond to @mentions or replies to Vibey.
    if (!isMentioned(msg) && !isReplyToBot(msg)) {
      return new Response("ok", { status: 200 });
    }

    // Strip the @mention from the text so the model doesn't see it as part of the message.
    const cleanText = userText
      .replace(new RegExp(`@${BOT_USERNAME}`, "gi"), "")
      .trim();

    // Typing indicator.
    await tg(TELEGRAM_BOT_TOKEN, "sendChatAction", { chat_id: chatId, action: "typing" });

    // Load agent config.
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("system_prompt, model, temperature, max_tokens")
      .eq("id", VIBEY_AGENT_ID)
      .maybeSingle();

    if (agentError || !agent) {
      console.error("Vibey agent not found", agentError);
      return new Response("ok", { status: 200 });
    }

    // Hydrate history for this group session + load community memories + per-user prefs.
    const [history, memories, userPrefs] = await Promise.all([
      loadHistory(supabase, sessionKey),
      loadRecentMemories(supabase),
      loadUserPreferences(supabase, { telegram_user_id: userId, telegram_username: msg.from?.username ?? null }),
    ]);
    const userContext = buildUserContextBlock(userPrefs, {
      display_name: msg.from?.first_name ?? null,
      telegram_username: msg.from?.username ?? null,
    });
    const systemPrompt = `${buildSystemPromptWithMemories(agent.system_prompt, memories)}\n\n${userContext}`;

    const reply = await runAgentLoop({
      supabase,
      apiKey: OPENROUTER_API_KEY,
      model: agent.model,
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.max_tokens ?? 2048,
      systemPrompt,
      history,
      userText: cleanText || userText,
      toolMetadata: {
        source: "telegram_group",
        chat_id: chatId,
        chat_title: msg.chat.title ?? null,
        telegram_user_id: userId,
        telegram_username: username,
      },
      referer: "https://t.me/vibey_ai_bot",
      title: "Vibey (Telegram)",
    });

    if (!reply) return new Response("ok", { status: 200 });

    const body = reply.length > 4000 ? reply.slice(0, 3997) + "..." : reply;

    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: body,
      reply_to_message_id: msg.message_id, // thread the reply
    });

    // Log the exchange.
    supabase.from("agent_chat_logs").insert({
      agent_id: VIBEY_AGENT_ID,
      community_id: VIBEY_COMMUNITY_ID,
      user_message: userText,
      agent_response: body,
      session_key: sessionKey,
      telegram_chat_id: chatId,
      telegram_user_id: userId,
      telegram_username: username,
    }).then(({ error }: { error: unknown }) => {
      if (error) console.error("Failed to log group chat:", error);
    });

    return new Response("ok", { status: 200 });
  }

  // ── Private chat: always respond ─────────────────────────────────────────

  await tg(TELEGRAM_BOT_TOKEN, "sendChatAction", { chat_id: chatId, action: "typing" });

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("system_prompt, model, temperature, max_tokens")
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

  const [history, memories, userPrefs] = await Promise.all([
    loadHistory(supabase, sessionKey),
    loadRecentMemories(supabase),
    loadUserPreferences(supabase, { telegram_user_id: userId, telegram_username: msg.from?.username ?? null }),
  ]);
  const userContext = buildUserContextBlock(userPrefs, {
    display_name: msg.from?.first_name ?? null,
    telegram_username: msg.from?.username ?? null,
  });
  const systemPrompt = `${buildSystemPromptWithMemories(agent.system_prompt, memories)}\n\n${userContext}`;

  const reply = await runAgentLoop({
    supabase,
    apiKey: OPENROUTER_API_KEY,
    model: agent.model,
    temperature: agent.temperature ?? 0.7,
    maxTokens: agent.max_tokens ?? 2048,
    systemPrompt,
    history,
    userText,
    toolMetadata: {
      source: "telegram_dm",
      chat_id: chatId,
      telegram_user_id: userId,
      telegram_username: username,
    },
    referer: "https://t.me/vibey_ai_bot",
    title: "Vibey (Telegram)",
  });

  if (!reply) return new Response("ok", { status: 200 });

  const body = reply.length > 4000 ? reply.slice(0, 3997) + "..." : reply;

  await tg(TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: body });

  supabase.from("agent_chat_logs").insert({
    agent_id: VIBEY_AGENT_ID,
    community_id: VIBEY_COMMUNITY_ID,
    user_message: userText,
    agent_response: body,
    session_key: sessionKey,
    telegram_chat_id: chatId,
    telegram_user_id: userId,
    telegram_username: username,
  }).then(({ error }: { error: unknown }) => {
    if (error) console.error("Failed to log private chat:", error);
  });

  return new Response("ok", { status: 200 });
});
