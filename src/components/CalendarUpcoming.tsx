import { Link } from "react-router-dom";
import { Calendar as CalendarIcon, ExternalLink } from "lucide-react";
import { useGoogleCalendarEvents, getEventStart, isAllDay } from "@/hooks/useGoogleCalendar";
import { Skeleton } from "@/components/ui/skeleton";

function formatWhen(d: Date | null, allDay: boolean) {
  if (!d) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = allDay
    ? "All day"
    : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

export function CalendarUpcoming({ limit = 5 }: { limit?: number }) {
  const { events, loading, error } = useGoogleCalendarEvents("primary", limit);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <p className="text-label">Upcoming · Calendar</p>
        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="space-y-3 overflow-hidden flex-1">
        {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        {!loading && error && (
          <p className="text-xs text-destructive line-clamp-3">{error}</p>
        )}
        {!loading && !error && events.length === 0 && (
          <p className="text-xs text-muted-foreground">No upcoming events.</p>
        )}
        {!loading && !error && events.slice(0, limit).map((e) => {
          const d = getEventStart(e);
          return (
            <a
              key={e.id}
              href={e.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="block border-l-2 border-primary/40 pl-3 py-1 hover:border-primary transition-colors"
            >
              <p className="text-xs font-medium truncate">{e.summary ?? "(no title)"}</p>
              <p className="text-[10px] text-muted-foreground font-mono uppercase">
                {formatWhen(d, isAllDay(e))}
              </p>
            </a>
          );
        })}
      </div>
      <Link
        to="/calendar"
        className="mt-3 text-[10px] uppercase tracking-wider font-mono text-primary inline-flex items-center gap-1 hover:underline"
      >
        Open full calendar <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
