import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, event } = body;

    // GET: list upcoming events
    if (action === "list" || req.method === "GET") {
      const now = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // Include events from last 2h
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, event_start_time, event_end_time, event_location, event_type, event_image_url, hosted_by, is_featured, tags")
        .eq("community_id", VIBEY_COMMUNITY_ID)
        .gte("event_end_time", now)
        .order("event_start_time", { ascending: true })
        .limit(50);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ events: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: create a new event
    if (action === "create" && event) {
      const { title, description, location, start_time, end_time, image_url, hosted_by, tags } = event;

      if (!title || !start_time) {
        return new Response(JSON.stringify({ error: "title and start_time are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the user's public profile id
      const { data: userRows } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", user.id)
        .limit(1);

      const createdBy = userRows?.[0]?.id ?? null;

      const startDate = new Date(start_time);
      const endDate = end_time ? new Date(end_time) : new Date(startDate.getTime() + 60 * 60 * 1000);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return new Response(JSON.stringify({ error: "Invalid date format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newEvent, error } = await supabase
        .from("events")
        .insert({
          community_id: VIBEY_COMMUNITY_ID,
          created_by: createdBy,
          title: title.trim(),
          description: description?.trim() || null,
          event_location: location?.trim() || null,
          event_image_url: image_url?.trim() || null,
          event_start_time: startDate.toISOString(),
          event_end_time: endDate.toISOString(),
          event_status: "published",
          event_type: "virtual",
          hosted_by: hosted_by?.trim() || "Vibey community",
          is_public: true,
          registration_required: false,
          tags: tags ?? ["vibey"],
          metadata: { source: "vibey_agent" },
        })
        .select("id, title, description, event_start_time, event_end_time, event_location, event_type, event_image_url, hosted_by, is_featured, tags")
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ event: newEvent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("community-events error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
