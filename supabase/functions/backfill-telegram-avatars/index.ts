// Edge function: one-time backfill of Telegram profile photos for existing
// users. Walks every users row that has a telegram_user_id but no
// telegram_photo_url, downloads their current Telegram profile photo, uploads
// it to the avatars bucket, and stores the public URL.
//
// Run: POST to this function (no body required). Returns a summary.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

async function downloadTelegramFile(
  botToken: string,
  fileId: string,
): Promise<{ bytes: Uint8Array; mime: string; filename: string } | null> {
  try {
    const fileResp = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
    );
    const fileJson = await fileResp.json();
    const filePath = fileJson?.result?.file_path;
    if (!filePath) return null;
    const dl = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (!dl.ok) return null;
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const mime = dl.headers.get("content-type") || "image/jpeg";
    const filename = filePath.split("/").pop() || "file.jpg";
    return { bytes, mime, filename };
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: users, error } = await supabase
    .from("users")
    .select("id, telegram_user_id")
    .not("telegram_user_id", "is", null)
    .is("telegram_photo_url", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let updated = 0;
  let noPhoto = 0;
  let failed = 0;

  for (const u of users ?? []) {
    processed++;
    const tgId = u.telegram_user_id as number;
    try {
      const photosResp = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUserProfilePhotos?user_id=${tgId}&limit=1`,
      );
      const photosJson = await photosResp.json();
      const photoSizes = photosJson?.result?.photos?.[0];
      if (!photoSizes || photoSizes.length === 0) {
        noPhoto++;
        continue;
      }
      // deno-lint-ignore no-explicit-any
      const largest = photoSizes.reduce((a: any, b: any) =>
        a.width * a.height > b.width * b.height ? a : b
      );
      const file = await downloadTelegramFile(TELEGRAM_BOT_TOKEN, largest.file_id);
      if (!file) {
        failed++;
        continue;
      }
      const ext = file.filename.split(".").pop() || "jpg";
      const path = `telegram/${tgId}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file.bytes, { contentType: file.mime, upsert: true });
      if (uploadErr) {
        failed++;
        continue;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) {
        failed++;
        continue;
      }
      const { error: updErr } = await supabase
        .from("users")
        .update({ telegram_photo_url: url })
        .eq("id", u.id);
      if (updErr) {
        failed++;
        continue;
      }
      updated++;
      // Telegram allows ~30 req/sec for bots; small delay to be safe.
      await new Promise((r) => setTimeout(r, 80));
    } catch (_e) {
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ processed, updated, noPhoto, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
