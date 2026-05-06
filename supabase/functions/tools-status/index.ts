// Returns the status of each Vibey tool. The tool registry now lives in the
// `agent_tools` table so admins can edit labels/descriptions/enabled state from
// the UI. This function merges the DB rows with runtime secret availability.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ToolStatus = {
  id: string;
  name: string;
  label: string;
  description: string;
  category: "memory" | "web" | "future";
  requiredSecrets: string[];
  is_enabled: boolean;
  sort_order: number;
  status: "ready" | "missing_secret" | "planned" | "disabled";
  missing: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("agent_tools")
    .select("id, name, label, description, category, required_secrets, is_enabled, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tools: ToolStatus[] = (data ?? []).map((t: any) => {
    const requiredSecrets: string[] = t.required_secrets ?? [];
    const missing = requiredSecrets.filter((s) => !Deno.env.get(s));
    let status: ToolStatus["status"];
    if (!t.is_enabled) status = "disabled";
    else if (t.category === "future") status = "planned";
    else if (missing.length > 0) status = "missing_secret";
    else status = "ready";
    return {
      id: t.id,
      name: t.name,
      label: t.label,
      description: t.description,
      category: t.category,
      requiredSecrets,
      is_enabled: t.is_enabled,
      sort_order: t.sort_order,
      status,
      missing,
    };
  });

  return new Response(JSON.stringify({ tools }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
