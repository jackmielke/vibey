// Returns Local Business AI Series workshop data (workshops + registrants + surveys)
// for the Vibey mini app's Workshops tab. Gated to admin telegram users.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_TELEGRAM_USER_IDS = new Set<number>([
  5780091237, // Jack Mielke
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)),
  );
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

async function validateInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("missing hash");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    botToken,
  );
  const computed = toHex(await hmacSha256(secretKey, dataCheckString));
  if (computed !== hash) throw new Error("invalid hash");

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    throw new Error("stale initData");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("missing user");
  return JSON.parse(userRaw) as { id: number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "missing env" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const initData = body?.initData;
    if (typeof initData !== "string" || !initData) {
      return json({ error: "initData required" }, 400);
    }
    const tgUser = await validateInitData(initData, BOT_TOKEN);
    if (!ADMIN_TELEGRAM_USER_IDS.has(tgUser.id)) {
      return json({ error: "not authorized" }, 403);
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [{ data: workshops }, { data: inquiries }, { data: surveys }] = await Promise.all([
      supa.from("workshops")
        .select("week, slug, title, subtitle, date_label, starts_at, tool, capacity, sort_order, is_published")
        .eq("is_published", true)
        .order("sort_order", { ascending: true }),
      supa.from("inquiries")
        .select("id, name, email, phone, business, workshop_weeks, status, sms_opt_in, message, created_at, notes")
        .eq("source", "workshop")
        .order("created_at", { ascending: false })
        .limit(500),
      supa.from("survey_responses")
        .select("id, business_name, contact_name, contact_email, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    return json({
      ok: true,
      workshops: workshops ?? [],
      inquiries: inquiries ?? [],
      surveys: surveys ?? [],
    });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 400);
  }
});
