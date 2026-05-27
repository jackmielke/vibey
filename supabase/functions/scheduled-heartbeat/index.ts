// Scheduled Heartbeat — Vibey's morning + evening agent runs.
//
// Triggered by pg_cron via run-automation (or directly). For each opted-in
// recipient, runs the full chat-with-vibey agent loop (with tools), records a
// trace in `heartbeat_runs`, and DMs the final message via Telegram.
//
// POST body: { automation_id?, kind?, dry_run?, user_id?, recipient_chat_id? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  VIBEY_AGENT_ID,
  buildEventsBlock,
  buildSkillsBlock,
  buildSystemPromptWithMemories,
  buildUserContextBlock,
  isAdminTelegramUser,
  loadEnabledSkills,
  loadRecentChatHistory,
  loadRecentMemories,
  loadUpcomingEvents,
  loadUserPreferences,
  runAgentLoop,
  unifiedSessionKey,
} from "../_shared/vibey-agent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_JACK_CHAT_ID = "5780091237";

type Kind = "morning" | "evening";

type Recipient = {
  user_id: string | null;
  telegram_chat_id: string;
  telegram_user_id: number | null;
  telegram_username: string | null;
  display_name: string | null;
  label: string | null;
};

async function sendTelegram(botToken: string, chatId: string, text: string): Promise<void> {
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
      body: JSON.stringify({ chat_id: chatId, text: chunk, disable_web_page_preview: true }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Telegram ${resp.status}: ${txt.slice(0, 300)}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: {
      automation_id?: string;
      kind?: Kind;
      dry_run?: boolean;
      user_id?: string;
      recipient_chat_id?: string;
    } = {};
    try { body = await req.json(); } catch { /* default */ }

    const dryRun = body.dry_run === true;

    // 1. Resolve automation + kind + seed prompt
    let automationId: string | null = body.automation_id ?? null;
    let kind: Kind | null = body.kind ?? null;
    let seedPrompt: string | null = null;

    if (automationId) {
      const { data: auto } = await supabase
        .from("automations")
        .select("id, prompt, config")
        .eq("id", automationId)
        .maybeSingle();
      if (auto) {
        seedPrompt = (auto.prompt ?? "").trim() || null;
        const cfgKind = (auto.config as Record<string, unknown> | null)?.kind;
        if (cfgKind === "morning" || cfgKind === "evening") kind = cfgKind;
      }
    } else if (kind) {
      const slug = kind === "morning" ? "morning-heartbeat" : "evening-heartbeat";
      const { data: auto } = await supabase
        .from("automations")
        .select("id, prompt")
        .eq("slug", slug)
        .maybeSingle();
      if (auto) {
        automationId = auto.id;
        seedPrompt = (auto.prompt ?? "").trim() || null;
      }
    }

    if (!kind) {
      return new Response(JSON.stringify({ error: "kind (morning|evening) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!seedPrompt) {
      const sharedFormat = `
Format the message like a quick scannable check-in (no greeting, no signoff — the header is auto-prepended):

✅ one line on what's already wrapped / done
⚡ one line on what's slipping or needs a nudge

🔴 Open & pressing:
• 4–8 short bullets, each one concrete person / decision / thing — name + one-line status
• keep each bullet to a single line if you can

End with one direct question — the most important thing you actually want to know from them right now.

Use the recent chat history, recent community chats (last ~24h), today's/tomorrow's calendar, and relevant Granola notes from the past week. Don't invent items — if you don't have signal, say so and ask. Keep your voice (lowercase, dry, warm). No preamble, no "here's your update", just the bullets.`;

      seedPrompt = kind === "morning"
        ? `It's 6am Pacific — morning check-in time.

Pull what's actually live for them today: open threads, who they owe a reply, calendar, anything that slipped yesterday.
${sharedFormat}`
        : `It's 9pm Pacific — evening check-in time.

Reflect on what actually happened today: who showed up, what got done, what stalled, what's worth carrying into tomorrow.
${sharedFormat}`;
    }

    // 2. Resolve recipients
    const recipients: Recipient[] = [];
    if (body.recipient_chat_id) {
      recipients.push({
        user_id: null,
        telegram_chat_id: String(body.recipient_chat_id),
        telegram_user_id: null,
        telegram_username: null,
        display_name: null,
        label: "manual",
      });
    } else {
      const subQ = supabase
        .from("heartbeat_subscriptions")
        .select("user_id, telegram_chat_id, users!inner(id, telegram_user_id, telegram_username, name)")
        .eq("kind", kind)
        .eq("enabled", true);
      const { data: subs, error: subErr } = body.user_id
        ? await subQ.eq("user_id", body.user_id)
        : await subQ;
      if (subErr) throw new Error(`subscriptions: ${subErr.message}`);
      for (const s of (subs ?? []) as Array<{
        user_id: string;
        telegram_chat_id: string | null;
        users: { id: string; telegram_user_id: number | null; telegram_username: string | null; name: string | null };
      }>) {
        const chatId = s.telegram_chat_id ?? (s.users.telegram_user_id ? String(s.users.telegram_user_id) : null);
        if (!chatId) continue;
        recipients.push({
          user_id: s.user_id,
          telegram_chat_id: chatId,
          telegram_user_id: s.users.telegram_user_id,
          telegram_username: s.users.telegram_username,
          display_name: s.users.name,
          label: s.users.name ?? s.users.telegram_username ?? null,
        });
      }
    }

    // Fallback: if nothing configured, send to Jack so the system never stays silent in testing.
    if (recipients.length === 0) {
      recipients.push({
        user_id: null,
        telegram_chat_id: DEFAULT_JACK_CHAT_ID,
        telegram_user_id: 5780091237,
        telegram_username: null,
        display_name: "Jack (fallback)",
        label: "fallback",
      });
    }

    // 3. Load Vibey's soul once
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("system_prompt, model, temperature, max_tokens")
      .eq("id", VIBEY_AGENT_ID)
      .maybeSingle();
    if (agentErr || !agent) throw new Error(`agent load: ${agentErr?.message ?? "not found"}`);

    const [memories, events, skills] = await Promise.all([
      loadRecentMemories(supabase),
      loadUpcomingEvents(supabase),
      loadEnabledSkills(supabase),
    ]);

    // 4. Run for each recipient
    const runResults: Array<Record<string, unknown>> = [];

    for (const r of recipients) {
      const startedAt = new Date();
      const isAdmin = isAdminTelegramUser(r.telegram_user_id);

      // Per-recipient user context
      const userPrefs = await loadUserPreferences(supabase, {
        telegram_user_id: r.telegram_user_id,
        telegram_username: r.telegram_username,
      });
      const userContext = buildUserContextBlock(userPrefs, {
        display_name: r.display_name,
        telegram_username: r.telegram_username,
      });

      const baseSystemPrompt = agent.system_prompt ?? "";
      const systemPrompt =
        `${buildSystemPromptWithMemories(baseSystemPrompt, memories, r.user_id, isAdmin)}` +
        `${buildEventsBlock(events)}\n\n${userContext}${buildSkillsBlock(skills)}`;

      // Recent conversation context (last ~24h, up to 10 exchanges) so the
      // heartbeat isn't blind to what was just discussed.
      const sessionKey = unifiedSessionKey(
        r.user_id ?? null,
        `telegram:${r.telegram_chat_id}`
      );
      const recentHistory = await loadRecentChatHistory(supabase, sessionKey, {
        limit: 10,
        sinceHours: 24,
      });

      // Open run row
      const { data: runRow } = await supabase
        .from("heartbeat_runs")
        .insert({
          automation_id: automationId,
          kind,
          recipient_user_id: r.user_id,
          recipient_chat_id: r.telegram_chat_id,
          recipient_label: r.label,
          system_prompt: systemPrompt,
          seed_prompt: seedPrompt,
          model: agent.model,
          status: "running",
          dry_run: dryRun,
          triggered_by: body.automation_id ? "schedule" : "manual",
        })
        .select("id")
        .single();

      const toolCalls: Array<Record<string, unknown>> = [];
      const thoughts: string[] = [];
      let promptTok = 0, completionTok = 0, totalTok = 0;

      let finalMessage = "";
      let runError: string | null = null;
      try {
        finalMessage = await runAgentLoop({
          supabase,
          apiKey: OPENROUTER_API_KEY,
          model: agent.model || "anthropic/claude-sonnet-4.5",
          temperature: agent.temperature ?? 0.7,
          maxTokens: Math.min(agent.max_tokens ?? 2048, 1500),
          systemPrompt,
          history: recentHistory,
          userText: seedPrompt,
          toolMetadata: { source: "heartbeat", kind, automation_id: automationId },
          callerVibeUserId: r.user_id ?? null,
          isAdmin,
          referer: "https://community-vibes-ai.lovable.app",
          title: `Vibey Heartbeat (${kind})`,
          onProgress: (ev) => {
            if (ev.status === "start") {
              toolCalls.push({ name: ev.name, args: ev.args, label: ev.label, started_at: new Date().toISOString() });
            } else if (ev.status === "done") {
              const last = toolCalls[toolCalls.length - 1];
              if (last && last.name === ev.name) {
                last.label_done = ev.label;
                last.details = ev.details;
                last.finished_at = new Date().toISOString();
              }
            } else if (ev.status === "thought") {
              thoughts.push(ev.content);
            }
          },
          onUsage: (u) => {
            promptTok += Number(u.prompt_tokens ?? 0);
            completionTok += Number(u.completion_tokens ?? 0);
            totalTok += Number(u.total_tokens ?? 0);
          },
        });
      } catch (e) {
        runError = e instanceof Error ? e.message : String(e);
      }

      // Prepend a deterministic header so every heartbeat is unmistakable.
      // e.g. "Heartbeat — Tuesday 2 PM"
      const headerFmt = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).formatToParts(finishedAtPlaceholder());
      const weekday = headerFmt.find((p) => p.type === "weekday")?.value ?? "";
      const hour = headerFmt.find((p) => p.type === "hour")?.value ?? "";
      const minute = headerFmt.find((p) => p.type === "minute")?.value ?? "";
      const dayPeriod = (headerFmt.find((p) => p.type === "dayPeriod")?.value ?? "").toUpperCase();
      const timeStr = minute === "00" ? `${hour} ${dayPeriod}` : `${hour}:${minute} ${dayPeriod}`;
      const header = `Heartbeat — ${weekday} ${timeStr}`;
      const deliveredMessage = finalMessage ? `${header}\n\n${finalMessage.trim()}` : "";

      // Deliver
      let deliveryStatus = "skipped";
      if (!dryRun && deliveredMessage && !runError) {
        if (!TELEGRAM_BOT_TOKEN) {
          deliveryStatus = "failed";
          runError = "TELEGRAM_BOT_TOKEN missing";
        } else {
          try {
            await sendTelegram(TELEGRAM_BOT_TOKEN, r.telegram_chat_id, deliveredMessage);
            deliveryStatus = "sent";
          } catch (e) {
            deliveryStatus = "failed";
            runError = e instanceof Error ? e.message : String(e);
          }
        }
      } else if (dryRun) {
        deliveryStatus = "dry_run";
      } else if (!finalMessage) {
        deliveryStatus = "failed";
        runError = runError ?? "empty model response";
      }

      const finishedAt = new Date();
      if (runRow?.id) {
        await supabase.from("heartbeat_runs").update({
          tool_calls: toolCalls,
          intermediate_thoughts: thoughts,
          final_message: finalMessage,
          tokens_prompt: promptTok || null,
          tokens_completion: completionTok || null,
          tokens_total: totalTok || null,
          duration_ms: finishedAt.getTime() - startedAt.getTime(),
          status: runError ? "failed" : "ok",
          delivery_status: deliveryStatus,
          error: runError,
          finished_at: finishedAt.toISOString(),
        }).eq("id", runRow.id);
      }

      runResults.push({
        run_id: runRow?.id ?? null,
        recipient: r.label ?? r.telegram_chat_id,
        delivery_status: deliveryStatus,
        tool_call_count: toolCalls.length,
        final_message: finalMessage.slice(0, 200),
        error: runError,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, kind, dry_run: dryRun, count: runResults.length, runs: runResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("scheduled-heartbeat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
