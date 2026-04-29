// Daily community recap.
//
// Pulls the last N hours of agent_chat_logs for the Vibey community, asks
// Vibey (via OpenRouter, using her own soul) to write a short pre-call brief,
// stores it in `daily_recaps`, and DMs it to a Telegram chat.
//
// Intended to be triggered by pg_cron, but also callable manually for testing:
//   POST /daily-recap { hours?: number, deliver_to?: string|number, dry_run?: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

// Default delivery target — Jack's personal Telegram DM. Overridable per call.
const DEFAULT_DELIVER_TO = "5780091237";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Log = {
  user_message: string | null;
  agent_response: string | null;
  telegram_username: string | null;
  session_key: string | null;
  created_at: string;
};

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://community-vibes-ai.lovable.app",
      "X-Title": "Vibey Daily Recap",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`OpenRouter ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const json = await resp.json();
  return (json?.choices?.[0]?.message?.content ?? "").trim();
}

async function sendTelegram(botToken: string, chatId: string, text: string): Promise<void> {
  // Telegram limit is 4096 chars per message. Chunk if needed.
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 4000) {
    let cut = remaining.lastIndexOf("\n\n", 4000);
    if (cut < 1000) cut = 4000;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);

  for (const chunk of chunks) {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    if (!resp.ok) {
      // Retry once without markdown in case formatting tripped Telegram.
      const fallback = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, disable_web_page_preview: true }),
      });
      if (!fallback.ok) {
        const txt = await fallback.text().catch(() => "");
        throw new Error(`Telegram ${fallback.status}: ${txt.slice(0, 300)}`);
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse body (all optional).
    let body: {
      hours?: number;
      deliver_to?: string | number;
      dry_run?: boolean;
      automation_id?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      // No body / invalid JSON — use defaults.
    }

    // If an automation_id is supplied, pull config + recipients from DB.
    let recipients: string[] = [];
    let hours = Math.max(1, Math.min(72, Number(body.hours) || 24));
    const dryRun = body.dry_run === true;

    if (body.automation_id) {
      const { data: auto, error: autoErr } = await supabase
        .from("automations")
        .select("id, config")
        .eq("id", body.automation_id)
        .maybeSingle();
      if (autoErr || !auto) throw new Error(`automation load: ${autoErr?.message ?? "not found"}`);
      const cfgHours = Number((auto.config as Record<string, unknown> | null)?.hours);
      if (Number.isFinite(cfgHours) && cfgHours > 0) hours = Math.max(1, Math.min(72, cfgHours));

      const { data: recs, error: recErr } = await supabase
        .from("automation_recipients")
        .select("chat_id, enabled, channel")
        .eq("automation_id", body.automation_id)
        .eq("enabled", true)
        .eq("channel", "telegram");
      if (recErr) throw new Error(`recipients load: ${recErr.message}`);
      recipients = (recs ?? []).map((r) => String(r.chat_id));
    }

    // Fallbacks for direct/manual invocation.
    if (recipients.length === 0) {
      recipients = [body.deliver_to ? String(body.deliver_to) : DEFAULT_DELIVER_TO];
    }
    const deliverTo = recipients[0]; // for legacy single-target persistence column

    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - hours * 3600 * 1000);

    // Pull chat logs in window.
    const { data: logs, error: logsErr } = await supabase
      .from("agent_chat_logs")
      .select("user_message, agent_response, telegram_username, session_key, created_at")
      .eq("community_id", VIBEY_COMMUNITY_ID)
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString())
      .order("created_at", { ascending: true })
      .limit(500);

    if (logsErr) throw new Error(`logs query: ${logsErr.message}`);
    const allLogs = (logs ?? []) as Log[];

    // Pull Granola meeting notes from the same window (best-effort — never fail the recap).
    let granolaNotes: Array<{ title?: string; created_at?: string; summary?: string }> = [];
    let granolaError: string | null = null;
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const GRANOLA_API_KEY = Deno.env.get("GRANOLA_API_KEY");
      if (LOVABLE_API_KEY && GRANOLA_API_KEY) {
        const url = `https://connector-gateway.lovable.dev/granola/v1/notes?limit=20&created_after=${encodeURIComponent(windowStart.toISOString())}`;
        const gResp = await fetch(url, {
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GRANOLA_API_KEY,
          },
        });
        if (!gResp.ok) {
          granolaError = `Granola ${gResp.status}: ${(await gResp.text()).slice(0, 200)}`;
        } else {
          const gJson = await gResp.json();
          granolaNotes = (gJson?.notes ?? []) as typeof granolaNotes;
        }
      } else {
        granolaError = "Granola not configured";
      }
    } catch (e) {
      granolaError = e instanceof Error ? e.message : String(e);
    }
    if (granolaError) console.warn("Granola fetch:", granolaError);

    const granolaBlock = granolaNotes.length === 0
      ? "(no Granola meeting notes in this window)"
      : granolaNotes
          .map((n) => {
            const ts = n.created_at ? new Date(n.created_at).toISOString().slice(0, 16).replace("T", " ") : "?";
            const summary = (n.summary ?? "").trim().slice(0, 800);
            return `### ${n.title ?? "Untitled"} — ${ts} UTC\n${summary}`;
          })
          .join("\n\n");

    // Format conversation transcript for the prompt.
    let transcript: string;
    if (allLogs.length === 0) {
      transcript = "(no chat activity in this window)";
    } else {
      transcript = allLogs
        .map((l) => {
          const who = l.telegram_username
            ? `@${l.telegram_username}`
            : l.session_key?.startsWith("web:")
            ? "web user"
            : "user";
          const ts = new Date(l.created_at).toISOString().slice(11, 16); // HH:MM UTC
          const u = (l.user_message ?? "").trim().slice(0, 500);
          const a = (l.agent_response ?? "").trim().slice(0, 500);
          return `[${ts}] ${who}: ${u}\nVibey: ${a}`;
        })
        .join("\n\n");
    }

    // Load Vibey's soul so the brief sounds like her.
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("system_prompt, model")
      .eq("id", VIBEY_AGENT_ID)
      .maybeSingle();
    if (agentErr || !agent) throw new Error(`agent load: ${agentErr?.message ?? "not found"}`);

    const systemPrompt = `${agent.system_prompt}\n\nYou are now writing a DAILY BRIEF for Jack, the residency host, before his daily community call. Stay in your voice but be concise and useful. This is internal — Jack is the only reader.`;

    const userPrompt = allLogs.length === 0 && granolaNotes.length === 0
      ? `It's quiet — no chats with you and no Granola meeting notes in the last ${hours}h. Write a brief 2-3 sentence note acknowledging the quiet window and suggesting one thing Jack might bring to the call to spark conversation.`
      : `Here's the last ${hours}h of context for the Vibey community: ${allLogs.length} chat exchanges with you and ${granolaNotes.length} Granola meeting notes. Write Jack a pre-call brief in markdown. Structure:

**TL;DR** — 1-2 sentence vibe check.
**Themes** — bullet list of 2-5 recurring topics or notable threads (weave in meeting topics where relevant).
**People** — anyone worth checking in with by name + why.
**From meetings** — 1-3 highlights from Granola notes that Jack should remember (skip if no notes).
**Suggested talking points** — 2-4 things Jack could raise on the call.

Keep it under 450 words. Be specific (quote briefly when useful). No fluff.

--- CHAT TRANSCRIPT ---
${transcript}

--- GRANOLA MEETING NOTES ---
${granolaBlock}
---`;

    const brief = await callOpenRouter(
      OPENROUTER_API_KEY,
      agent.model || "anthropic/claude-sonnet-4.5",
      systemPrompt,
      userPrompt,
      1200
    );

    if (!brief) throw new Error("model returned empty brief");

    // Compose final message.
    const header = `🌀 *Vibey Daily Brief* — last ${hours}h\n_${windowStart.toISOString().slice(0, 16).replace("T", " ")} → ${windowEnd.toISOString().slice(0, 16).replace("T", " ")} UTC_\n\n`;
    const fullMessage = header + brief;

    let deliveryStatus = "skipped";
    let deliveryError: string | null = null;

    if (!dryRun) {
      if (!TELEGRAM_BOT_TOKEN) {
        deliveryStatus = "failed";
        deliveryError = "TELEGRAM_BOT_TOKEN not configured";
      } else {
        const errors: string[] = [];
        let okCount = 0;
        for (const chat of recipients) {
          try {
            await sendTelegram(TELEGRAM_BOT_TOKEN, chat, fullMessage);
            okCount++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${chat}: ${msg}`);
            console.error("Telegram delivery failed for", chat, msg);
          }
        }
        if (okCount === recipients.length) deliveryStatus = "sent";
        else if (okCount === 0) {
          deliveryStatus = "failed";
          deliveryError = errors.join("; ");
        } else {
          deliveryStatus = "partial";
          deliveryError = errors.join("; ");
        }
      }
    }

    // Update automation status if invoked via automation_id.
    if (body.automation_id) {
      await supabase
        .from("automations")
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: deliveryStatus,
          last_run_error: deliveryError,
        })
        .eq("id", body.automation_id);
    }

    // Persist.
    const { data: saved, error: saveErr } = await supabase
      .from("daily_recaps")
      .insert({
        community_id: VIBEY_COMMUNITY_ID,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        brief,
        source_message_count: allLogs.length,
        delivered_to: dryRun ? null : deliverTo,
        delivery_status: deliveryStatus,
      })
      .select("id")
      .single();

    if (saveErr) console.error("Failed to persist recap:", saveErr.message);

    return new Response(
      JSON.stringify({
        ok: true,
        recap_id: saved?.id ?? null,
        window_hours: hours,
        source_messages: allLogs.length,
        delivery_status: deliveryStatus,
        delivery_error: deliveryError,
        brief,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("daily-recap error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
