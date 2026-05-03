// Format a memory for sharing into Telegram. Telegram's share URL only takes
// plain text, so we use Unicode characters to fake nice typographic quoting.
// (Bot API sendMessage with parse_mode=HTML would render <blockquote> properly,
// but t.me/share/url is plain text only.)

export type ShareableMemory = {
  content: string | null;
  tags?: string[] | null;
  created_at?: string;
};

export function formatMemoryForTelegram(m: ShareableMemory): string {
  const body = (m.content ?? "").trim();
  // Prefix every line with a quote bar so it reads like a pulled quote.
  const quoted = body
    .split("\n")
    .map((line) => `▎ ${line}`)
    .join("\n");

  const tags =
    m.tags && m.tags.length
      ? "\n\n" + m.tags.map((t) => `#${t.replace(/\s+/g, "_")}`).join(" ")
      : "";

  return `🧠 Vibey remembered:\n\n${quoted}${tags}`;
}

// Telegram-flavored HTML for use with Bot API sendMessage(parse_mode=HTML).
// Kept here so a future "send to my DM" edge function can reuse it.
export function formatMemoryAsTelegramHTML(m: ShareableMemory): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = escape((m.content ?? "").trim());
  const tags =
    m.tags && m.tags.length
      ? `\n\n<i>${m.tags
          .map((t) => `<code>#${escape(t.replace(/\s+/g, "_"))}</code>`)
          .join(" ")}</i>`
      : "";
  return `🧠 <b>Vibey remembered</b>\n\n<blockquote>${body}</blockquote>${tags}`;
}

export function buildTelegramShareUrl(text: string): string {
  // url param is required by Telegram's share endpoint; use a no-op anchor.
  return `https://t.me/share/url?url=${encodeURIComponent(
    "https://t.me/",
  )}&text=${encodeURIComponent(text)}`;
}
