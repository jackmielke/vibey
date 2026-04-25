// One-shot helper: GET → returns current webhook info.
// POST → sets webhook to this project's telegram-webhook function URL.
// Safe to call repeatedly. Delete after Vibey's webhook is wired up.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL) {
    return new Response(JSON.stringify({ error: "missing env" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;

  if (req.method === "GET") {
    const info = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    ).then((r) => r.json());
    return new Response(
      JSON.stringify({ current: info, target: webhookUrl }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // POST → set webhook
  const setRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "edited_message"],
      }),
    }
  ).then((r) => r.json());

  return new Response(JSON.stringify({ result: setRes, webhookUrl }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
