// Lists upcoming events from the connected Google Calendar account via the
// Lovable connector gateway. Read-only — uses the calendar.readonly scope
// already configured on the connection.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const GOOGLE_CALENDAR_API_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
    if (!GOOGLE_CALENDAR_API_KEY) {
      throw new Error(
        "GOOGLE_CALENDAR_API_KEY is not configured — connect Google Calendar in project settings."
      );
    }

    const url = new URL(req.url);
    const calendarId = url.searchParams.get("calendarId") ?? "primary";
    const maxResults = Number(url.searchParams.get("maxResults") ?? 25);
    const action = url.searchParams.get("action") ?? "events";

    const headers = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_CALENDAR_API_KEY,
      "Content-Type": "application/json",
    };

    // List user's calendars (so the UI can let admin pick which one to show)
    if (action === "calendarList") {
      const resp = await fetch(`${GATEWAY_URL}/users/me/calendarList`, { headers });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(
          `Google calendarList failed [${resp.status}]: ${JSON.stringify(data)}`
        );
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: upcoming events for one calendar
    const timeMin = new Date().toISOString();
    const params = new URLSearchParams({
      timeMin,
      maxResults: String(maxResults),
      singleEvents: "true",
      orderBy: "startTime",
    });

    const resp = await fetch(
      `${GATEWAY_URL}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers }
    );
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(
        `Google events failed [${resp.status}]: ${JSON.stringify(data)}`
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("google-calendar-events error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
