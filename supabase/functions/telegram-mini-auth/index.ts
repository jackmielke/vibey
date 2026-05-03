// Telegram Mini App auth: validates initData (HMAC) and returns a Supabase
// magiclink token_hash the client can exchange for a session via verifyOtp.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

// Telegram initData validation per https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
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

  // auth_date freshness — reject anything older than 24h
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) {
    throw new Error("stale initData");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("missing user");
  return JSON.parse(userRaw) as {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "missing env" }, 500);
    }

    const { initData } = await req.json();
    if (typeof initData !== "string" || !initData) {
      return json({ error: "initData required" }, 400);
    }

    const tgUser = await validateInitData(initData, BOT_TOKEN);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Synthetic email per Telegram user — keeps auth.users 1:1 with TG identity.
    const email = `tg-${tgUser.id}@vibey.telegram`;
    const displayName = [tgUser.first_name, tgUser.last_name]
      .filter(Boolean)
      .join(" ") || tgUser.username || `tg-${tgUser.id}`;

    // Ensure auth user exists
    const { data: existing } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    let userId: string | null = null;

    // Use the lookup via getUserByEmail-ish: createUser returns 422 if exists.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        telegram_user_id: tgUser.id,
        telegram_username: tgUser.username,
        name: displayName,
        avatar_url: tgUser.photo_url,
        source: "telegram_mini_app",
      },
    });

    if (created?.user) {
      userId = created.user.id;
    } else if (createErr) {
      // Already exists — find them
      const { data: list } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const found = list?.users.find((u) => u.email === email);
      if (!found) return json({ error: createErr.message }, 500);
      userId = found.id;
    }
    void existing;

    // Link the public.users row that already exists for this Telegram user
    // (telegram bot creates rows w/ telegram_user_id but auth_user_id = NULL).
    // Without this, RLS on memories/community_members will hide everything.
    const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    let publicUserId: string | null = null;
    if (userId) {
      // Try to find existing public.users row by telegram_user_id
      const { data: existingUser } = await admin
        .from("users")
        .select("id, auth_user_id")
        .eq("telegram_user_id", tgUser.id)
        .maybeSingle();

      if (existingUser) {
        publicUserId = existingUser.id;
        if (existingUser.auth_user_id !== userId) {
          await admin
            .from("users")
            .update({ auth_user_id: userId })
            .eq("id", existingUser.id);
        }
      } else {
        // Create a public.users row for this Telegram user
        const { data: newUser } = await admin
          .from("users")
          .insert({
            auth_user_id: userId,
            telegram_user_id: tgUser.id,
            name: displayName,
            avatar_url: tgUser.photo_url ?? null,
          })
          .select("id")
          .single();
        publicUserId = newUser?.id ?? null;
      }

      // Ensure community membership so RLS lets them read memories
      if (publicUserId) {
        const { data: existingMember } = await admin
          .from("community_members")
          .select("id")
          .eq("community_id", VIBEY_COMMUNITY_ID)
          .eq("user_id", publicUserId)
          .maybeSingle();
        if (!existingMember) {
          await admin.from("community_members").insert({
            community_id: VIBEY_COMMUNITY_ID,
            user_id: publicUserId,
            role: "member",
          });
        }
      }
    }

    // Generate a magiclink and return token_hash for client to verifyOtp
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      return json({ error: linkErr?.message ?? "no link" }, 500);
    }

    return json({
      token_hash: link.properties.hashed_token,
      email,
      user: {
        telegram_id: tgUser.id,
        name: displayName,
        username: tgUser.username,
        photo_url: tgUser.photo_url,
      },
    });
  } catch (e) {
    console.error("mini-auth error:", e);
    return json(
      { error: e instanceof Error ? e.message : "unknown error" },
      400,
    );
  }
});
