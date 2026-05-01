// Returns the status of each Vibey tool by checking which required secrets
// are configured in the edge runtime environment. The frontend uses this to
// render the Tools panel without ever exposing secret values.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ToolStatus = {
  name: string;
  label: string;
  description: string;
  category: "memory" | "web" | "future";
  requiredSecrets: string[];
  status: "ready" | "missing_secret" | "planned";
  missing: string[];
};

const TOOLS: Omit<ToolStatus, "status" | "missing">[] = [
  {
    name: "save_memory",
    label: "Save Memory",
    description:
      "Stores a durable fact about the community in long-term memory.",
    category: "memory",
    requiredSecrets: ["SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    name: "web_search",
    label: "Web Search",
    description:
      "Searches the live web via Brave for current info, news, and facts.",
    category: "web",
    requiredSecrets: ["BRAVE_SEARCH_API_KEY"],
  },
  {
    name: "fetch_url",
    label: "Fetch URL",
    description:
      "Fetches readable text from a specific web page (up to ~6k chars).",
    category: "web",
    requiredSecrets: [],
  },
  {
    name: "recall_memories",
    label: "Recall Memories",
    description:
      "Semantic search over the memory corpus. Coming when corpus outgrows preload.",
    category: "future",
    requiredSecrets: [],
  },
  {
    name: "send_telegram",
    label: "Send Telegram Message",
    description:
      "Proactively message a person or group on Telegram. Planned.",
    category: "future",
    requiredSecrets: ["TELEGRAM_BOT_TOKEN"],
  },
];

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const tools: ToolStatus[] = TOOLS.map((t) => {
    const missing = t.requiredSecrets.filter((s) => !Deno.env.get(s));
    let status: ToolStatus["status"];
    if (t.category === "future") status = "planned";
    else if (missing.length > 0) status = "missing_secret";
    else status = "ready";
    return { ...t, status, missing };
  });

  return new Response(JSON.stringify({ tools }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
