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
  buildSkillsBlock,
  buildSystemPromptWithMemories,
  buildUserContextBlock,
  isAdminTelegramUser,
  loadEnabledSkills,
  loadRecentMemories,
  loadUserPreferences,
  resolveVibeUserId,
  runAgentLoop,
  unifiedSessionKey,
} from "../_shared/vibey-agent.ts";

const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

// Convert markdown (as written by the LLM) to a subset of HTML that Telegram
// accepts with parse_mode=HTML. Supports: bold, italic, inline code, code
// blocks, links, strikethrough, headings (as bold), bullets.
function mdToTelegramHtml(input: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const blocks: string[] = [];
  let text = input.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = blocks.length;
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
    blocks.push(`<pre><code${langAttr}>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
    return `\u0000BLOCK${idx}\u0000`;
  });

  const inlines: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_m, code) => {
    const idx = inlines.length;
    inlines.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000INLINE${idx}\u0000`;
  });

  text = escapeHtml(text);

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) =>
    `<a href="${url}">${label}</a>`,
  );

  text = text.replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/__([^_\n]+?)__/g, "<b>$1</b>");
  text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<i>$2</i>");
  text = text.replace(/(^|[^_\w])_([^_\n]+?)_(?!_)/g, "$1<i>$2</i>");
  text = text.replace(/~~([^~\n]+?)~~/g, "<s>$1</s>");
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");
  text = text.replace(/^[ \t]*[-*]\s+/gm, "• ");

  text = text.replace(/\u0000INLINE(\d+)\u0000/g, (_m, i) => inlines[Number(i)] ?? "");
  text = text.replace(/\u0000BLOCK(\d+)\u0000/g, (_m, i) => blocks[Number(i)] ?? "");

  return text;
}
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

type TelegramPhotoSize = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
};

type TelegramDocument = {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
};

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  voice?: TelegramVoice;
  audio?: TelegramVoice;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
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

// ── Telegram file download + attachment handling ─────────────────────────────

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

async function downloadTelegramFile(
  botToken: string,
  fileId: string,
  fallbackMime?: string
): Promise<{ bytes: Uint8Array; mime: string; filename: string } | null> {
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
    const dl = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (!dl.ok) {
      console.error("file download failed", dl.status);
      return null;
    }
    const buf = new Uint8Array(await dl.arrayBuffer());
    const mime = dl.headers.get("content-type") || fallbackMime || "application/octet-stream";
    const filename = filePath.split("/").pop() || "file";
    return { bytes: buf, mime, filename };
  } catch (e) {
    console.error("downloadTelegramFile threw:", e);
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import(
      "https://esm.sh/unpdf@0.12.1"
    );
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = (Array.isArray(text) ? text.join("\n\n") : String(text || "")).trim();
    return merged || null;
  } catch (e) {
    console.error("extractPdfText threw:", e);
    return null;
  }
}

// Returns images (data URLs for vision), extraText (e.g. parsed PDFs to prepend),
// and an optional userError when we should bail with a friendly message.
async function processAttachments(
  botToken: string,
  msg: TelegramMessage
): Promise<{ images: { url: string }[]; extraText: string[]; userError?: string }> {
  const images: { url: string }[] = [];
  const extraText: string[] = [];

  if (msg.photo && msg.photo.length > 0) {
    const largest = msg.photo.reduce((a, b) =>
      (a.file_size ?? a.width * a.height) > (b.file_size ?? b.width * b.height) ? a : b
    );
    if ((largest.file_size ?? 0) > MAX_IMAGE_BYTES) {
      return { images, extraText, userError: "that photo's a bit too big — anything under ~10MB works." };
    }
    const file = await downloadTelegramFile(botToken, largest.file_id, "image/jpeg");
    if (!file) {
      return { images, extraText, userError: "couldn't download that photo — mind resending?" };
    }
    images.push({ url: `data:${file.mime};base64,${bytesToBase64(file.bytes)}` });
  }

  if (msg.document) {
    const doc = msg.document;
    const mime = (doc.mime_type || "").toLowerCase();
    const name = doc.file_name || "file";

    if (mime.startsWith("image/")) {
      if ((doc.file_size ?? 0) > MAX_IMAGE_BYTES) {
        return { images, extraText, userError: `"${name}" is too big — try under ~10MB.` };
      }
      const file = await downloadTelegramFile(botToken, doc.file_id, mime);
      if (!file) return { images, extraText, userError: `couldn't download "${name}".` };
      images.push({ url: `data:${file.mime};base64,${bytesToBase64(file.bytes)}` });
    } else if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      if ((doc.file_size ?? 0) > MAX_PDF_BYTES) {
        return { images, extraText, userError: `"${name}" is over 20MB — too chunky for me to read.` };
      }
      const file = await downloadTelegramFile(botToken, doc.file_id, "application/pdf");
      if (!file) return { images, extraText, userError: `couldn't download "${name}".` };
      const text = await extractPdfText(file.bytes);
      if (!text) {
        return { images, extraText, userError: `i grabbed "${name}" but couldn't pull any text — is it scanned/image-only?` };
      }
      const truncated = text.length > 60000 ? text.slice(0, 60000) + "\n…[truncated]" : text;
      extraText.push(`[Attached PDF: ${name}]\n\n${truncated}`);
    } else {
      return {
        images,
        extraText,
        userError: `i can read images and PDFs — "${name}" (${mime || "unknown type"}) isn't something i can open yet.`,
      };
    }
  }

  return { images, extraText };
}

// ── Telegram avatar caching ──────────────────────────────────────────────────
// Fetches the user's profile photo from Telegram, uploads to the avatars
// bucket, and stores the public URL on users.telegram_photo_url. Best-effort:
// returns silently on any failure. Skips if we already cached one recently.

// deno-lint-ignore no-explicit-any
async function ensureTelegramAvatar(
  supabase: any,
  botToken: string,
  vibeUserId: string | null,
  telegramUserId: number,
): Promise<void> {
  if (!vibeUserId) return;
  try {
    // Skip if we already have a photo cached.
    const { data: existing } = await supabase
      .from("users")
      .select("telegram_photo_url")
      .eq("id", vibeUserId)
      .maybeSingle();
    if (existing?.telegram_photo_url) return;

    // 1. Get user profile photos.
    const photosResp = await fetch(
      `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${telegramUserId}&limit=1`,
    );
    const photosJson = await photosResp.json();
    const photoSizes = photosJson?.result?.photos?.[0];
    if (!photoSizes || photoSizes.length === 0) return;
    // Pick the largest size.
    const largest = photoSizes.reduce(
      // deno-lint-ignore no-explicit-any
      (a: any, b: any) => (a.width * a.height > b.width * b.height ? a : b),
    );

    // 2. Download the file.
    const file = await downloadTelegramFile(botToken, largest.file_id, "image/jpeg");
    if (!file) return;

    // 3. Upload to avatars bucket.
    const ext = file.filename.split(".").pop() || "jpg";
    const path = `telegram/${telegramUserId}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file.bytes, {
        contentType: file.mime,
        upsert: true,
      });
    if (uploadErr) {
      console.error("avatar upload failed:", uploadErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub?.publicUrl;
    if (!url) return;

    // 4. Save URL on user row.
    await supabase
      .from("users")
      .update({ telegram_photo_url: url })
      .eq("id", vibeUserId);
  } catch (e) {
    console.error("ensureTelegramAvatar threw:", e);
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
  const fallbackSessionKey = `telegram:${chatId}`;

  // Resolve the user's text — text, caption (for photos/docs), or transcribed voice.
  let userText = (msg.text ?? msg.caption ?? "").trim();
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

    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: `🎙️ <i>${transcript.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</i>`,
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id,
    });
  }

  // Process photo / document attachments (images, PDFs).
  const hasAttachments = !!(msg.photo?.length || msg.document);
  let attachmentImages: { url: string }[] = [];
  let attachmentExtraText: string[] = [];
  if (hasAttachments) {
    await tg(TELEGRAM_BOT_TOKEN, "sendChatAction", { chat_id: chatId, action: "typing" });
    const result = await processAttachments(TELEGRAM_BOT_TOKEN, msg);
    if (result.userError) {
      await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: result.userError,
        reply_to_message_id: msg.message_id,
      });
      return new Response("ok", { status: 200 });
    }
    attachmentImages = result.images;
    attachmentExtraText = result.extraText;
    // If user sent only an attachment with no caption, give the model a default prompt.
    if (!userText) {
      if (attachmentImages.length > 0 && attachmentExtraText.length === 0) {
        userText = "(user sent an image with no caption — describe or react to it)";
      } else if (attachmentExtraText.length > 0 && attachmentImages.length === 0) {
        userText = "(user sent a PDF with no caption — summarize the key points)";
      } else {
        userText = "(user sent attachments with no caption)";
      }
    }
  }

  // No text and no attachments — nothing to do.
  if (!userText && attachmentImages.length === 0 && attachmentExtraText.length === 0) {
    return new Response("ok", { status: 200 });
  }

  // Prepend any parsed PDF text to the user message.
  const userTextForModel = attachmentExtraText.length > 0
    ? `${attachmentExtraText.join("\n\n")}\n\n---\n\n${userText}`
    : userText;


  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Resolve unified Vibe identity so web + Telegram share one conversation.
  // Group chats stay isolated per-group (multiple people in one room).
  const vibeUserId = await resolveVibeUserId(supabase, {
    telegram_user_id: userId,
    telegram_username: msg.from?.username ?? null,
  });
  let sessionKey = fallbackSessionKey;
  if (!isGroup) {
    sessionKey = unifiedSessionKey(vibeUserId, fallbackSessionKey);
  }

  // Best-effort: cache the user's Telegram profile photo so the mini app can
  // display it next to their memories. Fire-and-forget.
  ensureTelegramAvatar(supabase, TELEGRAM_BOT_TOKEN, vibeUserId, userId).catch(
    (e) => console.error("ensureTelegramAvatar failed:", e),
  );

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
    const cleanText = userTextForModel
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
    const [history, memories, userPrefs, skills] = await Promise.all([
      loadHistory(supabase, sessionKey),
      loadRecentMemories(supabase),
      loadUserPreferences(supabase, { telegram_user_id: userId, telegram_username: msg.from?.username ?? null }),
      loadEnabledSkills(supabase),
    ]);
    const userContext = buildUserContextBlock(userPrefs, {
      display_name: msg.from?.first_name ?? null,
      telegram_username: msg.from?.username ?? null,
    });
    const isAdmin = isAdminTelegramUser(userId);
    const systemPrompt = `${buildSystemPromptWithMemories(agent.system_prompt, memories, vibeUserId, isAdmin)}\n\n${userContext}${buildSkillsBlock(skills)}`;

    const reply = await runAgentLoop({
      supabase,
      apiKey: OPENROUTER_API_KEY,
      model: agent.model,
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.max_tokens ?? 2048,
      systemPrompt,
      history,
      userText: cleanText || userTextForModel,
      images: attachmentImages,
      toolMetadata: {
        source: "telegram_group",
        chat_id: chatId,
        chat_title: msg.chat.title ?? null,
        telegram_user_id: userId,
        telegram_username: username,
      },
      callerVibeUserId: vibeUserId,
      isAdmin,
      referer: "https://t.me/vibey_ai_bot",
      title: "Vibey (Telegram)",
    });

    if (!reply) return new Response("ok", { status: 200 });

    const body = reply.length > 4000 ? reply.slice(0, 3997) + "..." : reply;
    const html = mdToTelegramHtml(body);

    try {
      await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_to_message_id: msg.message_id, // thread the reply
      });
    } catch (e) {
      console.warn("HTML send failed in group, falling back to plain:", e);
      await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: body,
        reply_to_message_id: msg.message_id,
      });
    }

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

  const [history, memories, userPrefs, skills] = await Promise.all([
    loadHistory(supabase, sessionKey),
    loadRecentMemories(supabase),
    loadUserPreferences(supabase, { telegram_user_id: userId, telegram_username: msg.from?.username ?? null }),
    loadEnabledSkills(supabase),
  ]);
  const userContext = buildUserContextBlock(userPrefs, {
    display_name: msg.from?.first_name ?? null,
    telegram_username: msg.from?.username ?? null,
  });
  const isAdminDm = isAdminTelegramUser(userId);
  const systemPrompt = `${buildSystemPromptWithMemories(agent.system_prompt, memories, vibeUserId, isAdminDm)}\n\n${userContext}${buildSkillsBlock(skills)}`;

  const reply = await runAgentLoop({
    supabase,
    apiKey: OPENROUTER_API_KEY,
    model: agent.model,
    temperature: agent.temperature ?? 0.7,
    maxTokens: agent.max_tokens ?? 2048,
    systemPrompt,
    history,
    userText: userTextForModel,
    images: attachmentImages,
    toolMetadata: {
      source: "telegram_dm",
      chat_id: chatId,
      telegram_user_id: userId,
      telegram_username: username,
    },
    callerVibeUserId: vibeUserId,
    isAdmin: isAdminDm,
    referer: "https://t.me/vibey_ai_bot",
    title: "Vibey (Telegram)",
  });

  if (!reply) return new Response("ok", { status: 200 });

  const body = reply.length > 4000 ? reply.slice(0, 3997) + "..." : reply;
  const html = mdToTelegramHtml(body);

  try {
    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } catch (e) {
    console.warn("HTML send failed, falling back to plain:", e);
    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: body });
  }

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
