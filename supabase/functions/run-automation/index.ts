// Trigger an automation on demand. Looks up the automation, then invokes its
// edge function with `{ automation_id }` in the body. The downstream function
// is responsible for loading config + recipients and updating last_run_*.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const automationId = String(body.automation_id ?? "");
    const dryRun = body.dry_run === true;
    if (!automationId) {
      return new Response(JSON.stringify({ error: "automation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: auto, error } = await admin
      .from("automations")
      .select("id, edge_function, community_id, name")
      .eq("id", automationId)
      .maybeSingle();
    if (error || !auto) {
      return new Response(JSON.stringify({ error: "Automation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invoke the target function with service role auth, passing automation_id.
    const targetUrl = `${SUPABASE_URL}/functions/v1/${auto.edge_function}`;
    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ automation_id: automationId, dry_run: dryRun }),
    });

    const text = await resp.text();
    let result: unknown;
    try { result = JSON.parse(text); } catch { result = text; }

    return new Response(
      JSON.stringify({ ok: resp.ok, status: resp.status, automation: auto.name, result }),
      { status: resp.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
