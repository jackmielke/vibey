import { useEffect, useState } from "react";
import { Wrench, Loader2, Brain, Globe, Link2, Sparkles, Send, CheckCircle2, AlertTriangle, Clock, Pencil, PowerOff, NotebookText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

const ICONS: Record<string, typeof Brain> = {
  save_memory: Brain,
  update_memory: Brain,
  web_search: Globe,
  fetch_url: Link2,
  granola_notes: NotebookText,
  recall_memories: Sparkles,
  send_telegram: Send,
};

const CATEGORY_LABELS: Record<ToolStatus["category"], string> = {
  memory: "Memory",
  web: "Web",
  future: "Planned",
};

function StatusBadge({ status }: { status: ToolStatus["status"] }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
        <CheckCircle2 className="w-3 h-3" /> ready
      </span>
    );
  }
  if (status === "missing_secret") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
        <AlertTriangle className="w-3 h-3" /> needs secret
      </span>
    );
  }
  if (status === "disabled") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        <PowerOff className="w-3 h-3" /> off
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
      <Clock className="w-3 h-3" /> planned
    </span>
  );
}

export function ToolsSection() {
  const [tools, setTools] = useState<ToolStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ToolStatus | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCategory, setDraftCategory] = useState<ToolStatus["category"]>("web");
  const [saving, setSaving] = useState(false);

  async function reload() {
    const { data, error } = await supabase.functions.invoke("tools-status");
    if (error) {
      toast.error("Couldn't load tools", { description: error.message });
      return;
    }
    setTools((data?.tools ?? []) as ToolStatus[]);
  }

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, []);

  async function toggleEnabled(tool: ToolStatus, next: boolean) {
    setTools((prev) => prev.map((t) => (t.id === tool.id ? { ...t, is_enabled: next } : t)));
    const { error } = await supabase
      .from("agent_tools")
      .update({ is_enabled: next })
      .eq("id", tool.id);
    if (error) {
      toast.error("Couldn't update tool", { description: error.message });
      reload();
    } else {
      toast.success(`${tool.label} ${next ? "enabled" : "disabled"}`);
      reload();
    }
  }

  function openEdit(tool: ToolStatus) {
    setEditing(tool);
    setDraftLabel(tool.label);
    setDraftDescription(tool.description);
    setDraftCategory(tool.category);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("agent_tools")
      .update({
        label: draftLabel.trim(),
        description: draftDescription.trim(),
        category: draftCategory,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success("Tool updated");
    setEditing(null);
    reload();
  }

  const grouped = tools.reduce<Record<string, ToolStatus[]>>((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  const readyCount = tools.filter((t) => t.status === "ready").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {readyCount} of {tools.length} tools active · click any tool to edit
      </div>

      {(["memory", "web", "future"] as const).map((cat) => {
        const items = grouped[cat] ?? [];
        if (!items.length) return null;
        return (
          <div key={cat} className="space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABELS[cat]}
            </div>
            <div className="space-y-2">
              {items.map((t) => {
                const Icon = ICONS[t.name] ?? Wrench;
                return (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{t.label}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {t.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={t.status} />
                            <Switch
                              checked={t.is_enabled}
                              onCheckedChange={(v) => toggleEnabled(t, v)}
                              aria-label={`Toggle ${t.label}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t.description}
                        </p>
                        {t.status === "missing_secret" && t.missing.length > 0 && (
                          <p className="text-[11px] font-mono text-destructive mt-2">
                            missing: {t.missing.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit tool</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Internal name
                </Label>
                <p className="font-mono text-sm">{editing.name}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tool-label">Label</Label>
                <Input
                  id="tool-label"
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tool-desc">Description</Label>
                <Textarea
                  id="tool-desc"
                  rows={4}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Category
                </Label>
                <div className="flex gap-2">
                  {(["memory", "web", "future"] as const).map((c) => (
                    <Button
                      key={c}
                      type="button"
                      variant={draftCategory === c ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDraftCategory(c)}
                    >
                      {CATEGORY_LABELS[c]}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Note: this edits how the tool is shown and whether Vibey can call it.
                The underlying logic still lives in code.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !draftLabel.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
