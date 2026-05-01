import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

type Run = {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  triggered_by: string;
  dry_run: boolean;
  recipients_count: number | null;
  http_status: number | null;
  error: string | null;
  result: unknown;
};

const statusVariant = (s: string): "default" | "destructive" | "secondary" =>
  s === "sent" ? "default" : s === "failed" ? "destructive" : "secondary";

export function AutomationRunsPanel({ automationId, refreshKey }: { automationId: string; refreshKey?: number }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("automation_runs")
      .select("id, status, started_at, finished_at, duration_ms, triggered_by, dry_run, recipients_count, http_status, error, result")
      .eq("automation_id", automationId)
      .order("started_at", { ascending: false })
      .limit(10);
    if (!error) setRuns((data ?? []) as Run[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [automationId, refreshKey]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-label">Execution history</span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>
      {runs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No runs yet — hit Run now to fire one.</p>
      ) : (
        <div className="space-y-1">
          {runs.map((r) => {
            const open = expandedId === r.id;
            return (
              <div key={r.id} className="border border-border rounded">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedId(open ? null : r.id)}
                >
                  {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                  <Badge variant={statusVariant(r.status)} className="font-mono text-[10px] uppercase">
                    {r.status}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto font-mono">
                    {r.duration_ms != null ? `${r.duration_ms}ms` : "—"}
                    {" · "}
                    {r.triggered_by}{r.dry_run ? " · dry" : ""}
                  </span>
                </button>
                {open && (
                  <div className="px-3 pb-2 pt-1 space-y-1.5 text-xs border-t border-border">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                      <span>started</span><span>{format(new Date(r.started_at), "PPpp")}</span>
                      {r.finished_at && (<><span>finished</span><span>{format(new Date(r.finished_at), "PPpp")}</span></>)}
                      <span>recipients</span><span>{r.recipients_count ?? 0}</span>
                      <span>http</span><span>{r.http_status ?? "—"}</span>
                    </div>
                    {r.error && (
                      <pre className="whitespace-pre-wrap text-destructive bg-destructive/10 p-2 rounded font-mono text-[11px]">
                        {r.error}
                      </pre>
                    )}
                    {!!r.result && (
                      <details>
                        <summary className="cursor-pointer text-[11px] uppercase tracking-wider font-mono text-muted-foreground">Result</summary>
                        <pre className="mt-1 p-2 bg-muted/40 rounded text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                          {typeof r.result === "string" ? r.result : JSON.stringify(r.result, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
