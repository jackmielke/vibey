import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Sun, Moon, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Row = { id: string; slug: string; prompt: string | null; name: string | null };

const SLUGS = {
  morning: "morning-heartbeat",
  evening: "evening-heartbeat",
} as const;

type Kind = keyof typeof SLUGS;

export function HeartbeatSeedEditor() {
  const [rows, setRows] = useState<Record<Kind, Row | null>>({ morning: null, evening: null });
  const [drafts, setDrafts] = useState<Record<Kind, string>>({ morning: "", evening: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Kind | null>(null);
  const [openKind, setOpenKind] = useState<Kind | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("id, slug, prompt, name")
        .in("slug", [SLUGS.morning, SLUGS.evening]);
      if (error) toast.error("Failed to load seed prompts", { description: error.message });
      const next: Record<Kind, Row | null> = { morning: null, evening: null };
      const nextDrafts: Record<Kind, string> = { morning: "", evening: "" };
      for (const r of (data ?? []) as Row[]) {
        const k: Kind | null = r.slug === SLUGS.morning ? "morning" : r.slug === SLUGS.evening ? "evening" : null;
        if (k) { next[k] = r; nextDrafts[k] = r.prompt ?? ""; }
      }
      setRows(next);
      setDrafts(nextDrafts);
      setLoading(false);
    })();
  }, []);

  const save = async (kind: Kind) => {
    const row = rows[kind];
    if (!row) return;
    setSaving(kind);
    const { error } = await supabase
      .from("automations")
      .update({ prompt: drafts[kind] })
      .eq("id", row.id);
    setSaving(null);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    setRows((p) => ({ ...p, [kind]: { ...row, prompt: drafts[kind] } }));
    toast.success(`${kind} seed prompt saved`);
  };

  const Section = ({ kind, icon: Icon, label }: { kind: Kind; icon: typeof Sun; label: string }) => {
    const open = openKind === kind;
    const dirty = (rows[kind]?.prompt ?? "") !== drafts[kind];
    return (
      <div className="border border-border rounded">
        <button
          type="button"
          onClick={() => setOpenKind(open ? null : kind)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-wider">{label} seed prompt</span>
          {dirty && <span className="text-[10px] text-primary font-mono">· unsaved</span>}
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
            {drafts[kind].length} chars
          </span>
        </button>
        {open && (
          <div className="border-t border-border p-3 space-y-2">
            <Textarea
              value={drafts[kind]}
              onChange={(e) => setDrafts((p) => ({ ...p, [kind]: e.target.value }))}
              className="min-h-[260px] font-mono text-xs leading-relaxed"
              placeholder="Seed prompt that kicks off the heartbeat run..."
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                This is the user-turn prompt the agent sees. Vibey's full soul + memories + events are loaded automatically — keep this focused on the task ("morning check-in", desired format, what to look up).
              </p>
              <Button size="sm" onClick={() => save(kind)} disabled={!dirty || saving === kind} className="gap-1.5">
                {saving === kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="p-3 flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading seed prompts…
      </Card>
    );
  }

  return (
    <div className="space-y-2 mb-4">
      <Section kind="morning" icon={Sun} label="morning" />
      <Section kind="evening" icon={Moon} label="evening" />
    </div>
  );
}
