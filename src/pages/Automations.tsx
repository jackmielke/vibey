import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Play, Plus, Trash2, Clock, Zap, Heart } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const SCHEDULE_PRESETS: { value: string; cron: string; label: string }[] = [
  { value: "daily-8am-pt", cron: "0 15 * * *", label: "Daily · 8:00 AM Pacific" },
  { value: "daily-9am-pt", cron: "0 16 * * *", label: "Daily · 9:00 AM Pacific" },
  { value: "daily-6pm-pt", cron: "0 1 * * *", label: "Daily · 6:00 PM Pacific" },
  { value: "weekly-mon-9am-pt", cron: "0 16 * * 1", label: "Weekly · Mon 9:00 AM Pacific" },
  { value: "hourly", cron: "0 * * * *", label: "Hourly" },
  { value: "manual", cron: "", label: "Manual only (no schedule)" },
];

const RUNNER_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "vibey-prompt", label: "Run a prompt via Vibey", hint: "Generic — Vibey reads memories/tools and replies to your prompt." },
  { value: "daily-recap", label: "Daily community recap", hint: "Reads last 24h of chat and writes a brief." },
];

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `heartbeat-${Date.now()}`;
}

type Automation = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  edge_function: string;
  prompt: string | null;
  schedule_cron: string | null;
  schedule_label: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
};

type Recipient = {
  id: string;
  automation_id: string;
  channel: string;
  chat_id: string;
  label: string | null;
  enabled: boolean;
};

export default function Automations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [recipients, setRecipients] = useState<Record<string, Recipient[]>>({});
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [newRecip, setNewRecip] = useState<Record<string, { chat_id: string; label: string }>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: autos, error: e1 }, { data: recs, error: e2 }] = await Promise.all([
      supabase.from("automations").select("*").order("name"),
      supabase.from("automation_recipients").select("*"),
    ]);
    if (e1) toast.error("Failed to load automations", { description: e1.message });
    if (e2) toast.error("Failed to load recipients", { description: e2.message });
    setAutomations((autos ?? []) as Automation[]);
    const grouped: Record<string, Recipient[]> = {};
    for (const r of (recs ?? []) as Recipient[]) {
      (grouped[r.automation_id] ??= []).push(r);
    }
    setRecipients(grouped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runNow = async (a: Automation, dryRun = false) => {
    setRunningId(a.id);
    try {
      const { data, error } = await supabase.functions.invoke("run-automation", {
        body: { automation_id: a.id, dry_run: dryRun },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; result?: unknown };
      if (result?.ok) {
        toast.success(`${a.name} sent`, { description: dryRun ? "Dry run — nothing delivered." : "Delivered to recipients." });
      } else {
        toast.error(`${a.name} failed`, { description: JSON.stringify(result?.result).slice(0, 200) });
      }
      await load();
    } catch (e) {
      toast.error("Run failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunningId(null);
    }
  };

  const toggleEnabled = async (a: Automation, enabled: boolean) => {
    const { error } = await supabase.from("automations").update({ enabled }).eq("id", a.id);
    if (error) toast.error("Update failed", { description: error.message });
    else { setAutomations((prev) => prev.map((x) => x.id === a.id ? { ...x, enabled } : x)); }
  };

  const addRecipient = async (automationId: string) => {
    const draft = newRecip[automationId];
    if (!draft?.chat_id?.trim()) return;
    const { data, error } = await supabase
      .from("automation_recipients")
      .insert({
        automation_id: automationId,
        channel: "telegram",
        chat_id: draft.chat_id.trim(),
        label: draft.label?.trim() || null,
      })
      .select()
      .single();
    if (error) { toast.error("Failed to add", { description: error.message }); return; }
    setRecipients((prev) => ({ ...prev, [automationId]: [...(prev[automationId] ?? []), data as Recipient] }));
    setNewRecip((prev) => ({ ...prev, [automationId]: { chat_id: "", label: "" } }));
  };

  const removeRecipient = async (r: Recipient) => {
    const { error } = await supabase.from("automation_recipients").delete().eq("id", r.id);
    if (error) { toast.error("Failed to remove", { description: error.message }); return; }
    setRecipients((prev) => ({
      ...prev,
      [r.automation_id]: (prev[r.automation_id] ?? []).filter((x) => x.id !== r.id),
    }));
  };

  const toggleRecipient = async (r: Recipient, enabled: boolean) => {
    const { error } = await supabase.from("automation_recipients").update({ enabled }).eq("id", r.id);
    if (error) { toast.error("Update failed", { description: error.message }); return; }
    setRecipients((prev) => ({
      ...prev,
      [r.automation_id]: (prev[r.automation_id] ?? []).map((x) => x.id === r.id ? { ...x, enabled } : x),
    }));
  };

  return (
    <PageShell title="Scheduled Heartbeat" description="Recurring tasks Vibey runs on its own — daily check-ins, recaps, nudges.">
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
        </div>
      ) : automations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No automations yet.</p>
      ) : (
        <div className="space-y-4">
          {automations.map((a) => {
            const recs = recipients[a.id] ?? [];
            const draft = newRecip[a.id] ?? { chat_id: "", label: "" };
            return (
              <Card key={a.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Zap className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-mono text-sm uppercase tracking-wider">{a.name}</h3>
                      {a.last_run_status && (
                        <Badge
                          variant={a.last_run_status === "sent" ? "default" : a.last_run_status === "failed" ? "destructive" : "secondary"}
                          className="font-mono text-[10px] uppercase"
                        >
                          {a.last_run_status}
                        </Badge>
                      )}
                    </div>
                    {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      {a.schedule_label && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.schedule_label}</span>
                      )}
                      {a.last_run_at && (
                        <span>last run {formatDistanceToNow(new Date(a.last_run_at), { addSuffix: true })}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch checked={a.enabled} onCheckedChange={(v) => toggleEnabled(a, v)} />
                    <Button
                      size="sm"
                      onClick={() => runNow(a, false)}
                      disabled={runningId === a.id}
                      className="gap-1.5"
                    >
                      {runningId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      Run now
                    </Button>
                  </div>
                </div>

                {a.prompt && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-mono uppercase tracking-wider text-muted-foreground">Prompt</summary>
                    <pre className="mt-2 p-3 bg-muted/50 rounded text-xs whitespace-pre-wrap font-mono">{a.prompt}</pre>
                  </details>
                )}

                {a.last_run_error && (
                  <div className="text-xs text-destructive font-mono p-2 bg-destructive/10 rounded">
                    {a.last_run_error}
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border">
                  <Label className="text-label">Recipients</Label>
                  {recs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No recipients configured.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {recs.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 text-sm">
                          <Switch checked={r.enabled} onCheckedChange={(v) => toggleRecipient(r, v)} />
                          <span className="font-mono text-xs">{r.chat_id}</span>
                          {r.label && <span className="text-muted-foreground">— {r.label}</span>}
                          <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto" onClick={() => removeRecipient(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Input
                      placeholder="Telegram chat ID"
                      value={draft.chat_id}
                      onChange={(e) => setNewRecip((p) => ({ ...p, [a.id]: { ...draft, chat_id: e.target.value } }))}
                      className="font-mono text-xs h-8"
                    />
                    <Input
                      placeholder="Label (optional)"
                      value={draft.label}
                      onChange={(e) => setNewRecip((p) => ({ ...p, [a.id]: { ...draft, label: e.target.value } }))}
                      className="text-xs h-8"
                    />
                    <Button size="sm" variant="outline" onClick={() => addRecipient(a.id)} className="gap-1 shrink-0">
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
