import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GCalEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  organizer?: { email: string; displayName?: string };
};

export type GCalCalendar = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
};

export function getEventStart(e: GCalEvent): Date | null {
  const iso = e.start?.dateTime ?? e.start?.date;
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function isAllDay(e: GCalEvent) {
  return Boolean(e.start?.date && !e.start?.dateTime);
}

export function useGoogleCalendarEvents(calendarId = "primary", maxResults = 25) {
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error } = await supabase.functions.invoke(
        `google-calendar-events?calendarId=${encodeURIComponent(calendarId)}&maxResults=${maxResults}`,
        { method: "GET" }
      );
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else if ((data as any)?.error) {
        setError((data as any).error);
      } else {
        setEvents(((data as any)?.items ?? []) as GCalEvent[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [calendarId, maxResults]);

  return { events, loading, error };
}

export function useGoogleCalendarList() {
  const [calendars, setCalendars] = useState<GCalCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke(
        "google-calendar-events?action=calendarList",
        { method: "GET" }
      );
      if (cancelled) return;
      if (error) setError(error.message);
      else if ((data as any)?.error) setError((data as any).error);
      else setCalendars(((data as any)?.items ?? []) as GCalCalendar[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { calendars, loading, error };
}
