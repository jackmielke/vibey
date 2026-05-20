import { useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGoogleCalendarEvents,
  useGoogleCalendarList,
  getEventStart,
  isAllDay,
  type GCalEvent,
} from "@/hooks/useGoogleCalendar";
import { CalendarRange, MapPin, Users, ExternalLink } from "lucide-react";

function dayKey(d: Date) {
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function timeLabel(e: GCalEvent) {
  const d = getEventStart(e);
  if (!d) return "—";
  if (isAllDay(e)) return "All day";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function CalendarPage() {
  const [calendarId, setCalendarId] = useState("primary");
  const { calendars, loading: calsLoading } = useGoogleCalendarList();
  const { events, loading, error } = useGoogleCalendarEvents(calendarId, 50);

  const grouped = useMemo(() => {
    const map = new Map<string, GCalEvent[]>();
    for (const e of events) {
      const d = getEventStart(e);
      if (!d) continue;
      const key = dayKey(d);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <PageShell
      title="Shared Calendar"
      description="Upcoming events from the connected Google account."
      actions={
        <Select value={calendarId} onValueChange={setCalendarId}>
          <SelectTrigger className="w-[240px] font-mono text-xs">
            <SelectValue placeholder={calsLoading ? "Loading…" : "Choose calendar"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            {calendars
              .filter((c) => c.id !== "primary")
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.summary}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      }
    >
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!loading && !error && grouped.length === 0 && (
        <div className="rounded-md border border-border bg-card p-8 text-center">
          <CalendarRange className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No upcoming events on this calendar.</p>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(([day, items]) => (
          <section key={day} className="space-y-2">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {day}
            </h2>
            <div className="rounded-md border border-border bg-card divide-y divide-border">
              {items.map((e) => (
                <a
                  key={e.id}
                  href={e.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors group"
                >
                  <div className="w-20 shrink-0 font-mono text-xs text-primary tabular-nums">
                    {timeLabel(e)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.summary ?? "(no title)"}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {e.location && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[280px]">
                          <MapPin className="h-3 w-3" /> {e.location}
                        </span>
                      )}
                      {e.attendees && e.attendees.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {e.attendees.length}
                        </span>
                      )}
                      {e.organizer?.displayName && (
                        <Badge variant="outline" className="font-mono text-[10px] py-0">
                          {e.organizer.displayName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
