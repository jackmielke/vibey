import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Activity, Play, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

type ToolCall = {
  name: string;
  args?: Record<string, unknown>;
  label?: string;
  label_done?: string;
  details?: string;
  started_at?: string;
  finished_at?: string;
};

type Run = {
  id: string;
  automation_id: string | null;
  kind: "morning" | "evening";
  recipient_chat_id: string | null;
  recipient_label: string | null;
  system_prompt: string | null;
  seed_prompt: string | null;
  tool_calls: ToolCall[];
  intermediate_thoughts: string[];
  final_message: string | null;
  model: string | null;
  tokens_prompt: number | null;
  tokens_completion: number | null;
  tokens_total: number | null;
  duration_ms: number | null;
  status: string;
  delivery_status: string | null;
  error: string | null;
  dry_run: boolean;
  triggered_by: string;
  created_at: string;
  finished_at: string | null;
};

const KindIcon = ({ kind, className }: { kind: string; className?: string }) =>
  kind === "morning" ? <Sun className={className} /> : <Moon className={className} />;

export default function Heartbeats() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [firing, setFiring] = useState<"morning" | "evening" | null>(null);
  const [filter, setFilter] = useState<"all" | "morning" | "evening">("all");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("heartbeat_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (filter !== "all") q = q.eq("kind", filter);
    const { data, error } = await q;
    if (error) toast.error("Failed to load runs", { description: error.message });
    setRuns((data ?? []) as unknown as Run[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const fire = async (kind: "morning" | "evening", dryRun: boolean) => {
    setFiring(kind);
    try {
      const { data, error } = await supabase.functions.invoke("scheduled-heartbeat", {
        body: { kind, dry_run: dryRun, recipient_chat_id: dryRun ? undefined : undefined },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; count?: number };
      toast.success(`${kind} heartbeat fired`, {
        description: `${res?.count ?? 0} recipient(s)${dryRun ? " · dry run" : ""}`,
      });
      await load();
    } catch (e) {
      toast.error("Run failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setFiring(null);
    }
  };

  const actions = (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      </Button>
      <Button size="sm" variant="outline" onClick={() => fire("morning", false)} disabled={firing !== null} className="gap-1.5">
        {firing === "morning" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sun className="h-3.5 w-3.5" />}
        Fire morning
      </Button>
      <Button size="sm" variant="outline" onClick={() => fire("evening", false)} disabled={firing !== null} className="gap-1.5">
        {firing === "evening" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Moon className="h-3.5 w-3.5" />}
        Fire evening
      </Button>
    </div>
  );

  return (
    <PageShell
      title="Heartbeat Runs"
      description="Every scheduled run Vibey has done — what she thought, what tools she called, what she sent."
      actions={actions}
    >
      <div className="flex items-center gap-2 mb-4">
        {(["all", "morning", "evening"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider border transition-colors ${
              filter === k
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-transparent border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Activity className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No heartbeat runs yet. Fire one above to test.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => {
            const open = expandedId === r.id;
            const ok = r.status === "ok" && (r.delivery_status === "sent" || r.delivery_status === "dry_run");
            return (
              <Card key={r.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <KindIcon kind={r.kind} className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-mono text-xs uppercase tracking-wider">{r.kind}</span>
                  <Badge variant={ok ? "default" : r.status === "failed" ? "destructive" : "secondary"} className="font-mono text-[10px] uppercase">
                    {r.status === "ok" ? (r.delivery_status ?? "ok") : r.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                    → {r.recipient_label ?? r.recipient_chat_id ?? "—"} ·{" "}
                    {r.final_message ? r.final_message.slice(0, 80) : "(no message)"}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                    {r.tool_calls?.length ?? 0} tools · {r.duration_ms ?? "—"}ms ·{" "}
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-border px-4 py-3 space-y-3 text-sm bg-muted/20">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
                      <span>started</span><span>{format(new Date(r.created_at), "PPpp")}</span>
                      {r.finished_at && (<><span>finished</span><span>{format(new Date(r.finished_at), "PPpp")}</span></>)}
                      <span>model</span><span className="truncate">{r.model ?? "—"}</span>
                      <span>tokens</span><span>{r.tokens_total ?? "—"} ({r.tokens_prompt ?? "?"}→{r.tokens_completion ?? "?"})</span>
                      <span>triggered</span><span>{r.triggered_by}{r.dry_run ? " · dry" : ""}</span>
                      <span>delivery</span><span>{r.delivery_status ?? "—"}</span>
                    </div>

                    {r.error && (
                      <pre className="whitespace-pre-wrap text-destructive bg-destructive/10 p-2 rounded font-mono text-[11px]">
                        {r.error}
                      </pre>
                    )}

                    <details open>
                      <summary className="cursor-pointer text-label">Seed prompt</summary>
                      <pre className="mt-1 p-2 bg-background rounded text-[11px] whitespace-pre-wrap border border-border">
                        {r.seed_prompt ?? "(none)"}
                      </pre>
                    </details>

                    {r.tool_calls && r.tool_calls.length > 0 && (
                      <details open>
                        <summary className="cursor-pointer text-label">Tool calls · {r.tool_calls.length}</summary>
                        <div className="mt-2 space-y-1.5">
                          {r.tool_calls.map((t, i) => (
                            <div key={i} className="border border-border rounded p-2 text-[11px] font-mono space-y-1 bg-background">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px]">{t.name}</Badge>
                                <span className="text-muted-foreground truncate">{t.label_done ?? t.label}</span>
                              </div>
                              {t.args && Object.keys(t.args).length > 0 && (
                                <pre className="text-muted-foreground whitespace-pre-wrap text-[10px]">
                                  {JSON.stringify(t.args, null, 2)}
                                </pre>
                              )}
                              {t.details && (
                                <pre className="text-muted-foreground whitespace-pre-wrap text-[10px] max-h-32 overflow-auto">
                                  {t.details}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {r.intermediate_thoughts && r.intermediate_thoughts.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-label">Thoughts · {r.intermediate_thoughts.length}</summary>
                        <div className="mt-2 space-y-1.5">
                          {r.intermediate_thoughts.map((t, i) => (
                            <pre key={i} className="p-2 bg-background border border-border rounded text-[11px] whitespace-pre-wrap">{t}</pre>
                          ))}
                        </div>
                      </details>
                    )}

                    <details open>
                      <summary className="cursor-pointer text-label">Final message</summary>
                      <div className="mt-1 p-3 bg-background rounded border border-border whitespace-pre-wrap text-sm leading-relaxed">
                        {r.final_message ?? "(empty)"}
                      </div>
                    </details>

                    <details>
                      <summary className="cursor-pointer text-label">System prompt</summary>
                      <pre className="mt-1 p-2 bg-background rounded text-[10px] whitespace-pre-wrap border border-border max-h-64 overflow-auto">
                        {r.system_prompt ?? "(none)"}
                      </pre>
                    </details>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
