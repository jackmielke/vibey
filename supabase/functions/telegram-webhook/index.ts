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
  addUsage,
  buildEventsBlock,
  buildSkillsBlock,
  buildSystemPromptWithMemories,
  buildUserContextBlock,
  createUsageAccumulator,
  isAdminTelegramUser,
  loadEnabledSkills,
  loadRecentMemories,
  loadUpcomingEvents,
  loadUserPreferences,
  resolveVibeUserId,
  runAgentLoop,
  unifiedSessionKey,
  usageSummary,
} from "../_shared/vibey-agent.ts";

const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

// Shared HTML escape for any text we drop into parse_mode=HTML payloads.
function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Build the "thinking trace" appended to the finalized status message.
// Renders as a collapsed <blockquote expandable> so the summary stays compact
// but admins can tap to see every tool call + intermediate reasoning.
function buildThinkingTrace(summary: string, trace: string[]): string {
  if (trace.length === 0) return summary;
  const lines = trace
    // Render each trace line as markdown -> Telegram HTML so Vibey's own
    // **bold**, *italic*, `code`, links etc. render properly inside the
    // expandable blockquote (same converter the main reply uses).
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => mdToTelegramHtml(line));
  if (lines.length === 0) return summary;
  // Cap trace length to stay safely under Telegram's 4096-char message limit.
  const MAX_CHARS = 3500;
  let joined = lines.join("\n");
  if (joined.length > MAX_CHARS) {
    joined = joined.slice(0, MAX_CHARS - 3) + "...";
  }
  const block = `<blockquote expandable>🧠 thinking trace\n${joined}</blockquote>`;
  return summary ? `${summary}\n${block}` : block;
}

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

  // Bold first, allowing single `*` (italic) inside — match anything that
  // isn't a literal `**` so we don't get tripped up by `**foo *bar* baz**`.
  text = text.replace(/\*\*((?:(?!\*\*)[\s\S])+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/__([^_\n]+?)__/g, "<b>$1</b>");
  // Italic: single `*` not adjacent to another `*` (so we don't re-match the
  // bold tags we just emitted), and not inside an HTML tag.
  text = text.replace(/(^|[^*<\w])\*([^*\n]+?)\*(?!\*)/g, "$1<i>$2</i>");
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
  video?: TelegramDocument;
  video_note?: TelegramDocument;
  animation?: TelegramDocument;
  sticker?: TelegramDocument;
  reply_to_message?: TelegramMessage;
  entities?: Array<{ type: string; offset: number; length: number }>;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

// Telegram update_ids are scoped per bot. If multiple bots in the same group
// point at this function, the same human message arrives with different
// update_ids. Add a second idempotency key based on chat_id + message_id so
// only one invocation can answer that shared group message.
function telegramMessageDedupKey(chatId: number, messageId: number): string {
  const input = `${chatId}:${messageId}`;
  let hash = 1469598103934665603n;
  const prime = 1099511628211n;
  const mask = (1n << 62n) - 1n;

  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }

  return `-${(hash || 1n).toString()}`;
}

// deno-lint-ignore no-explicit-any
async function markTelegramDedup(supabase: any, key: number | string, label: string): Promise<"new" | "duplicate" | "error"> {
  const { error } = await supabase
    .from("telegram_processed_updates")
    .insert({ update_id: key });

  if (!error) return "new";
  // 23505 = unique_violation → already handled.
  // deno-lint-ignore no-explicit-any
  if ((error as any).code === "23505") {
    console.log(`Duplicate ${label} ${key} — skipping.`);
    return "duplicate";
  }

  console.error(`${label} dedup insert failed:`, error);
  return "error";
}

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

// Create a live-updating status message in Telegram. Steps are appended as
// they happen via `update(step)`; `finalize(summary)` replaces it with a
// compact one-line collapsed summary (or deletes it if `summary` is empty).
function createStatusMessage(token: string, chatId: number, reply_to_message_id?: number) {
  let messageId: number | null = null;
  const steps: string[] = [];
  let initPromise: Promise<void> | null = null;
  let lastEdit: Promise<void> = Promise.resolve();

  const init = async () => {
    const res = await tg(token, "sendMessage", {
      chat_id: chatId,
      text: "✨ thinking…",
      reply_to_message_id,
      disable_notification: true,
    });
    try {
      const json = await res.clone().json();
      messageId = json?.result?.message_id ?? null;
    } catch { /* ignore */ }
  };

  const render = () => {
    if (steps.length === 0) return "✨ thinking…";
    // Keep last ~12 steps so the message doesn't blow past 4096 chars.
    const shown = steps.slice(-12);
    // Run each line through the same markdown -> HTML converter the final
    // reply uses, so Vibey's **bold** etc. render live during streaming
    // instead of showing as literal asterisks until finalize swaps in the
    // already-converted trace block.
    const lines = shown.map((line) => mdToTelegramHtml(line));
    return `✨ thinking…\n${lines.join("\n")}`;
  };

  const flush = () => {
    lastEdit = lastEdit.then(async () => {
      if (!messageId) return;
      await tg(token, "editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: render(),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }).catch(() => { /* ignore rate-limit / not-modified / malformed-HTML */ });
    });
  };

  return {
    start: () => {
      if (!initPromise) initPromise = init();
      return initPromise;
    },
    push: (line: string) => {
      steps.push(line);
      flush();
    },
    finalize: async (summary: string) => {
      await initPromise;
      await lastEdit;
      if (!messageId) return;
      if (!summary) {
        await tg(token, "deleteMessage", { chat_id: chatId, message_id: messageId })
          .catch(() => { /* ignore */ });
        return;
      }
      await tg(token, "editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: summary,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }).catch(() => { /* ignore */ });
    },
  };
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

// Anthropic vision (via OpenRouter) only accepts image/jpeg, image/png,
// image/gif, image/webp. Telegram often returns content-type "image/jpg",
// "application/octet-stream" or similar. Normalize by sniffing magic bytes,
// then fall back to mapping known aliases.
function normalizeImageMime(mime: string, bytes: Uint8Array): string | null {
  // Magic-byte sniff first — most reliable.
  if (bytes.length >= 4) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
      return "image/png";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return "image/webp";
  }
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  if (m === "image/jpeg" || m === "image/png" || m === "image/gif" || m === "image/webp") return m;
  if (m === "image/jpg" || m === "image/pjpeg") return "image/jpeg";
  return null;
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
    const normalized = normalizeImageMime(file.mime, file.bytes) ?? "image/jpeg";
    images.push({ url: `data:${normalized};base64,${bytesToBase64(file.bytes)}` });
  }

  // Stickers — animated/video stickers we can't read; static webp stickers we can.
  if (msg.sticker) {
    const s = msg.sticker;
    const file = await downloadTelegramFile(botToken, s.file_id, "image/webp");
    if (file) {
      const normalized = normalizeImageMime(file.mime, file.bytes);
      if (normalized) {
        images.push({ url: `data:${normalized};base64,${bytesToBase64(file.bytes)}` });
      } else {
        return { images, extraText, userError: "cute sticker, but i can only read static image stickers right now." };
      }
    }
  }

  // Videos / video notes / GIFs — vision models in this stack don't accept video.
  if (msg.video || msg.video_note || msg.animation) {
    return {
      images,
      extraText,
      userError:
        "i can't watch videos yet — only images and PDFs for now. if you grab a screenshot from it i can take a look ✌️",
    };
  }

  if (msg.document) {
    const doc = msg.document;
    const mime = (doc.mime_type || "").toLowerCase();
    const name = doc.file_name || "file";

    if (mime.startsWith("video/")) {
      return {
        images,
        extraText,
        userError:
          "i can't watch videos yet — only images and PDFs for now. if you grab a screenshot from it i can take a look ✌️",
      };
    }

    if (mime.startsWith("image/")) {
      if ((doc.file_size ?? 0) > MAX_IMAGE_BYTES) {
        return { images, extraText, userError: `"${name}" is too big — try under ~10MB.` };
      }
      const file = await downloadTelegramFile(botToken, doc.file_id, mime);
      if (!file) return { images, extraText, userError: `couldn't download "${name}".` };
      const normalized = normalizeImageMime(file.mime || mime, file.bytes);
      if (!normalized) {
        return {
          images,
          extraText,
          userError: `"${name}" is an image format i can't read (need jpeg, png, gif, or webp).`,
        };
      }
      images.push({ url: `data:${normalized};base64,${bytesToBase64(file.bytes)}` });
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

// ── ElevenLabs TTS + Telegram audio ──────────────────────────────────────────

// Pinned Vibey voice — gender-neutral robotic voice requested by the project owner.
// Keep this explicit so Telegram TTS cannot silently fall back to a different voice.
const VIBEY_VOICE_ID = "5nKWJuFC6bX0w7HcS5KI";

async function elevenLabsTts(text: string): Promise<Uint8Array | null> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    console.error("ELEVENLABS_API_KEY not configured for /voice");
    return null;
  }
  const voiceId = VIBEY_VOICE_ID;
  console.log("elevenlabs tts voice_id", voiceId);
  // Trim very long replies — voice should be short anyway.
  const safe = text.length > 2500 ? text.slice(0, 2500) : text;
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: safe,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
      }),
    },
  );
  if (!resp.ok) {
    console.error("elevenlabs tts failed", resp.status, await resp.text().catch(() => ""));
    return null;
  }
  return new Uint8Array(await resp.arrayBuffer());
}

// Send as a true Telegram "voice message" (round waveform bubble) rather than
// a music-file audio attachment. Modern Telegram clients accept MP3 here and
// render the voice-message UI. Used for the /voice-reply flow where the user
// wants a quick voice bubble of whatever message they're replying to.
async function sendTelegramVoice(
  token: string,
  chatId: number,
  mp3: Uint8Array,
  replyTo?: number,
): Promise<void> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (replyTo) form.append("reply_to_message_id", String(replyTo));
  if (replyTo) form.append("allow_sending_without_reply", "true");
  form.append("voice", new Blob([mp3], { type: "audio/mpeg" }), "vibey.mp3");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error("sendVoice failed", res.status, errorText);
    if (replyTo && errorText.includes("message to be replied not found")) {
      await sendTelegramVoice(token, chatId, mp3);
    }
  }
}

async function sendTelegramAudio(
  token: string,
  chatId: number,
  mp3: Uint8Array,
  title: string,
  replyTo?: number,
): Promise<void> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("title", title);
  form.append("performer", "Vibey");
  if (replyTo) form.append("reply_to_message_id", String(replyTo));
  if (replyTo) form.append("allow_sending_without_reply", "true");
  form.append("audio", new Blob([mp3], { type: "audio/mpeg" }), "vibey.mp3");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendAudio`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    console.error("sendAudio failed", res.status, errorText);
    if (replyTo && errorText.includes("message to be replied not found")) {
      await sendTelegramAudio(token, chatId, mp3, title);
    }
  }
}

// Detects `/voice`, `/voice@bot`, `/voice some text` → returns the inner text
// (empty string if no prompt was given) or null if not a voice command.
function parseVoiceCommand(text: string | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const m = trimmed.match(/^\/voice(?:@[\w_]+)?(?:\s+([\s\S]*))?$/i);
  if (!m) return null;
  return (m[1] ?? "").trim();
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

  // Idempotency: if Telegram retries this update (e.g. because our response
  // took longer than its timeout), short-circuit so we don't double-reply.
  // We do this BEFORE doing any other work.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  if (typeof update.update_id === "number") {
    const updateDedup = await markTelegramDedup(supabase, update.update_id, "update_id");
    if (updateDedup === "duplicate") return new Response("ok", { status: 200 });
  }

  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  const userId = msg.from?.id ?? chatId;
  const username = msg.from?.username ?? msg.from?.first_name ?? "unknown";
  const isGroup = chatType === "group" || chatType === "supergroup";
  const fallbackSessionKey = `telegram:${chatId}`;

  // Resolve unified Vibe identity early so slash commands can use the same
  // session as normal Telegram DMs.
  const vibeUserId = await resolveVibeUserId(supabase, {
    telegram_user_id: userId,
    telegram_username: msg.from?.username ?? null,
  });
  let sessionKey = fallbackSessionKey;
  if (!isGroup) {
    sessionKey = unifiedSessionKey(vibeUserId, fallbackSessionKey);
  }

  // In group chats, duplicate-looking responses can come from two bot accounts
  // whose webhooks both target this function. Telegram gives each bot a unique
  // update_id, so update_id-only dedup won't catch that. chat_id/message_id will.
  if (isGroup && typeof msg.message_id === "number") {
    const messageDedup = await markTelegramDedup(
      supabase,
      telegramMessageDedupKey(chatId, msg.message_id),
      "group message"
    );
    if (messageDedup === "duplicate") return new Response("ok", { status: 200 });
  }

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
  const hasAttachments = !!(
    msg.photo?.length || msg.document || msg.video || msg.video_note || msg.animation || msg.sticker
  );
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

  // /voice command (admin only, private DM only): rewrite userText so the
  // normal agent flow runs, then set a flag so we also send a TTS audio reply.
  // Empty "/voice" replays the most recent assistant message as audio.
  let wantsVoice = false;

  // Natural-language voice request: if the user asks for a voice note / voice
  // reply / audio response (and they're an admin in DMs), flip wantsVoice so the
  // normal reply is also sent as TTS audio — no /voice command needed.
  if (!isGroup && isAdminTelegramUser(userId) && userText) {
    const lower = userText.toLowerCase();
    const voiceIntentPatterns = [
      /\bvoice\s*(note|message|memo|reply|response|answer)\b/,
      /\b(reply|respond|answer|say it|tell me)\s+(back\s+)?(with|in|using|as)\s+(a\s+)?voice\b/,
      /\b(send|leave|record|drop)\s+(me\s+)?(a\s+)?(voice|audio)\b/,
      /\bspeak\s+(it|your\s+(reply|response|answer))\b/,
      /\bsay\s+it\s+out\s+loud\b/,
      /\b(use|with)\s+your\s+voice\b/,
    ];
    if (voiceIntentPatterns.some((re) => re.test(lower))) {
      wantsVoice = true;
    }
  }



  // Admin-only — works in DMs and groups. Standard users see no response.
  if (isAdminTelegramUser(userId)) {
    const voicePrompt = parseVoiceCommand(userText);
    if (voicePrompt !== null) {
      if (voicePrompt.length === 0) {
        // If this /voice is a reply to another message, TTS that message's text.
        const repliedText =
          msg.reply_to_message?.text?.trim() ||
          msg.reply_to_message?.caption?.trim() ||
          "";
        let sourceText = repliedText;
        let label = "vibey · voice";
        const isReplyVoice = repliedText.length > 0;

        if (!sourceText) {
          // Fallback: replay the last assistant reply in this session as audio.
          const { data: lastLog } = await supabase
            .from("agent_chat_logs")
            .select("agent_response")
            .eq("session_key", sessionKey)
            .not("agent_response", "is", null)
            .neq("agent_response", "")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          sourceText = (lastLog?.agent_response as string | undefined) ?? "";
          label = "vibey · replay";
        }

        if (!sourceText) {
          await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "nothing to voice — reply to a message with /voice, or use /voice <text>",
            reply_to_message_id: msg.message_id,
          });
          return new Response("ok", { status: 200 });
        }
        await tg(TELEGRAM_BOT_TOKEN, "sendChatAction", { chat_id: chatId, action: "record_voice" });
        const mp3 = await elevenLabsTts(sourceText);
        if (!mp3) {
          await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
            chat_id: chatId,
            text: "voice generation failed — check ELEVENLABS_API_KEY",
            reply_to_message_id: msg.message_id,
          });
          return new Response("ok", { status: 200 });
        }
        // Reply-to-message → send as a true voice-message bubble.
        // Replay-last-reply fallback → send as audio file (longer content, music UI fits better).
        if (isReplyVoice) {
          await sendTelegramVoice(TELEGRAM_BOT_TOKEN, chatId, mp3, msg.reply_to_message?.message_id ?? msg.message_id);
        } else {
          await sendTelegramAudio(TELEGRAM_BOT_TOKEN, chatId, mp3, label, msg.message_id);
        }
        return new Response("ok", { status: 200 });

      }
      // /voice <prompt> — run the agent on the prompt and also send audio.
      userText = voicePrompt;
      wantsVoice = true;
    }
  }

  // No text and no attachments — nothing to do.
  if (!userText && attachmentImages.length === 0 && attachmentExtraText.length === 0) {
    return new Response("ok", { status: 200 });
  }

  // If the user replied to another message, surface that context to the model
  // so it knows what they're referring to.
  let replyContext = "";
  const repliedTo = msg.reply_to_message;
  if (repliedTo) {
    const repliedText = (repliedTo.text ?? repliedTo.caption ?? "").trim();
    if (repliedText) {
      const isBot = !!repliedTo.from?.is_bot;
      const author = isBot
        ? "you (Vibey, earlier)"
        : repliedTo.from?.first_name
          ? `${repliedTo.from.first_name}${repliedTo.from.username ? ` (@${repliedTo.from.username})` : ""}`
          : repliedTo.from?.username
            ? `@${repliedTo.from.username}`
            : "someone earlier";
      const snippet = repliedText.length > 1200 ? repliedText.slice(0, 1200) + "…" : repliedText;
      replyContext = `[The user is replying to a message from ${author}:\n"""${snippet}"""]\n\n`;
    }
  }

  // Prepend any parsed PDF text and reply context to the user message.
  const baseUserText = replyContext + userText;
  const userTextForModel = attachmentExtraText.length > 0
    ? `${attachmentExtraText.join("\n\n")}\n\n---\n\n${baseUserText}`
    : baseUserText;

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
    // But still log every group message so Chat History shows the full conversation.
    if (!isMentioned(msg) && !isReplyToBot(msg)) {
      if (userText || attachmentImages.length > 0 || attachmentExtraText.length > 0) {
        supabase.from("agent_chat_logs").insert({
          agent_id: VIBEY_AGENT_ID,
          community_id: VIBEY_COMMUNITY_ID,
          user_message: userText || "(attachment)",
          agent_response: "",
          session_key: sessionKey,
          telegram_chat_id: chatId,
          telegram_user_id: userId,
          telegram_username: username,
        }).then(({ error }: { error: unknown }) => {
          if (error) console.error("Failed to log passive group message:", error);
        });
      }
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
    const [history, memories, events, userPrefs, skills] = await Promise.all([
      loadHistory(supabase, sessionKey),
      loadRecentMemories(supabase),
      loadUpcomingEvents(supabase),
      loadUserPreferences(supabase, { telegram_user_id: userId, telegram_username: msg.from?.username ?? null }),
      loadEnabledSkills(supabase),
    ]);
    const userContext = buildUserContextBlock(userPrefs, {
      display_name: msg.from?.first_name ?? null,
      telegram_username: msg.from?.username ?? null,
    });
    const isAdmin = isAdminTelegramUser(userId);
    const systemPrompt = `${buildSystemPromptWithMemories(agent.system_prompt, memories, vibeUserId, isAdmin)}${buildEventsBlock(events)}\n\n${userContext}${buildSkillsBlock(skills)}`;

    const status = createStatusMessage(TELEGRAM_BOT_TOKEN, chatId, msg.message_id);
    let toolCount = 0;
    const counts: Record<string, number> = {};
    const trace: string[] = [];
    const usage = createUsageAccumulator();

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
      onUsage: (u) => addUsage(usage, u),
      onProgress: async (evt) => {
        await status.start();
        if (evt.status === "start") {
          toolCount++;
          counts[evt.name] = (counts[evt.name] ?? 0) + 1;
          status.push(evt.label);
          trace.push(`• ${evt.label}`);
        } else if (evt.status === "done") {
          status.push(`  ↳ ${evt.label}`);
          trace.push(`  ↳ ${evt.label}`);
        } else if (evt.status === "thought") {
          const thought = evt.content.length > 220 ? evt.content.slice(0, 217) + "..." : evt.content;
          status.push(`💭 ${thought}`);
          trace.push(`💭 ${thought}`);
        }
      },
    });

    const summary = toolCount > 0
      ? `<i>used ${toolCount} step${toolCount === 1 ? "" : "s"}: ${
          Object.entries(counts)
            .map(([n, c]) => `${c}× ${n.replace(/_/g, " ")}`)
            .join(" · ")
        }</i>`
      : "";
    await status.finalize(buildThinkingTrace(summary, trace));

    if (!reply) {
      await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "got a little tangled up on that one — mind asking again or scoping it down?",
        reply_to_message_id: msg.message_id,
      });
      return new Response("ok", { status: 200 });
    }

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
    const usageData = usageSummary(usage);
    supabase.from("agent_chat_logs").insert({
      agent_id: VIBEY_AGENT_ID,
      community_id: VIBEY_COMMUNITY_ID,
      user_message: userText,
      agent_response: body,
      tokens_used: usageData.total_tokens,
      prompt_tokens: usageData.prompt_tokens,
      completion_tokens: usageData.completion_tokens,
      total_tokens: usageData.total_tokens,
      cost_credits: usageData.cost_credits,
      openrouter_model: agent.model,
      usage_json: usageData.usage_json,
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

  // Scripted /start onboarding: instant reply + quick-action keyboard, then
  // a short follow-up. Skip the LLM entirely so first impression is snappy.
  if (userText === "/start" || userText.startsWith("/start ") || userText === `/start@${BOT_USERNAME}`) {
    const firstName = msg.from?.first_name?.trim();
    const greeting = firstName ? `Hey ${firstName}, I'm Vibey.` : `Hey, I'm Vibey.`;
    const welcome =
      `${greeting} A community AI for Edge Esmeralda, built by the Vibe Ventures crew. ` +
      `Think of me as a friend who knows everyone here.`;

    const quickActions = {
      keyboard: [
        [{ text: "What's happening today?" }, { text: "Who's around?" }],
        [{ text: "What is Vibey?" }, { text: "Try a voice note 🎙" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
      input_field_placeholder: "ask me anything…",
    };

    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: welcome,
      reply_markup: quickActions,
    });

    await tg(TELEGRAM_BOT_TOKEN, "sendChatAction", { chat_id: chatId, action: "typing" });
    await new Promise((r) => setTimeout(r, 1200));

    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: "Ask me what's on today, who's around, or anything about Edge Esmeralda. Tap a button below or just type.",
      reply_markup: quickActions,
    });

    supabase.from("agent_chat_logs").insert({
      agent_id: VIBEY_AGENT_ID,
      community_id: VIBEY_COMMUNITY_ID,
      user_message: "/start",
      agent_response: welcome,
      session_key: sessionKey,
      telegram_chat_id: chatId,
      telegram_user_id: userId,
      telegram_username: username,
    }).then(({ error }: { error: unknown }) => {
      if (error) console.error("Failed to log /start:", error);
    });

    return new Response("ok", { status: 200 });
  }

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

  const [history, memories, events, userPrefs, skills] = await Promise.all([
    loadHistory(supabase, sessionKey),
    loadRecentMemories(supabase),
    loadUpcomingEvents(supabase),
    loadUserPreferences(supabase, { telegram_user_id: userId, telegram_username: msg.from?.username ?? null }),
    loadEnabledSkills(supabase),
  ]);
  const userContext = buildUserContextBlock(userPrefs, {
    display_name: msg.from?.first_name ?? null,
    telegram_username: msg.from?.username ?? null,
  });
  const isAdminDm = isAdminTelegramUser(userId);
  const systemPrompt = `${buildSystemPromptWithMemories(agent.system_prompt, memories, vibeUserId, isAdminDm)}${buildEventsBlock(events)}\n\n${userContext}${buildSkillsBlock(skills)}`;

  const dmStatus = createStatusMessage(TELEGRAM_BOT_TOKEN, chatId);
  let dmToolCount = 0;
  const dmCounts: Record<string, number> = {};
  const dmTrace: string[] = [];
  const dmUsage = createUsageAccumulator();

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
    onUsage: (u) => addUsage(dmUsage, u),
    onProgress: async (evt) => {
      await dmStatus.start();
      if (evt.status === "start") {
        dmToolCount++;
        dmCounts[evt.name] = (dmCounts[evt.name] ?? 0) + 1;
        dmStatus.push(evt.label);
        dmTrace.push(`• ${evt.label}`);
      } else if (evt.status === "done") {
        dmStatus.push(`  ↳ ${evt.label}`);
        dmTrace.push(`  ↳ ${evt.label}`);
      } else if (evt.status === "thought") {
        const thought = evt.content.length > 220 ? evt.content.slice(0, 217) + "..." : evt.content;
        dmStatus.push(`💭 ${thought}`);
        dmTrace.push(`💭 ${thought}`);
      }
    },
  });

  const dmSummary = dmToolCount > 0
    ? `<i>used ${dmToolCount} step${dmToolCount === 1 ? "" : "s"}: ${
        Object.entries(dmCounts)
          .map(([n, c]) => `${c}× ${n.replace(/_/g, " ")}`)
          .join(" · ")
      }</i>`
    : "";
  await dmStatus.finalize(buildThinkingTrace(dmSummary, dmTrace));

  if (!reply) {
    await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
      chat_id: chatId,
      text: "got a little tangled up on that one — mind asking again or scoping it down?",
    });
    return new Response("ok", { status: 200 });
  }

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

  if (wantsVoice) {
    await tg(TELEGRAM_BOT_TOKEN, "sendChatAction", { chat_id: chatId, action: "record_voice" });
    const mp3 = await elevenLabsTts(body);
    if (mp3) {
      await sendTelegramAudio(TELEGRAM_BOT_TOKEN, chatId, mp3, "vibey", msg.message_id);
    } else {
      await tg(TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "(voice gen failed)",
        reply_to_message_id: msg.message_id,
      });
    }
  }


  const dmUsageData = usageSummary(dmUsage);
  supabase.from("agent_chat_logs").insert({
    agent_id: VIBEY_AGENT_ID,
    community_id: VIBEY_COMMUNITY_ID,
    user_message: userText,
    agent_response: body,
    tokens_used: dmUsageData.total_tokens,
    prompt_tokens: dmUsageData.prompt_tokens,
    completion_tokens: dmUsageData.completion_tokens,
    total_tokens: dmUsageData.total_tokens,
    cost_credits: dmUsageData.cost_credits,
    openrouter_model: agent.model,
    usage_json: dmUsageData.usage_json,
    session_key: sessionKey,
    telegram_chat_id: chatId,
    telegram_user_id: userId,
    telegram_username: username,
  }).then(({ error }: { error: unknown }) => {
    if (error) console.error("Failed to log private chat:", error);
  });

  return new Response("ok", { status: 200 });
});
