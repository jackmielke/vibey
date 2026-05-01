import { useEffect, useState } from "react";
import { Wrench, Loader2, Brain, Globe, Link2, Sparkles, Send, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ToolStatus = {
  name: string;
  label: string;
  description: string;
  category: "memory" | "web" | "future";
  requiredSecrets: string[];
  status: "ready" | "missing_secret" | "planned";
  missing: string[];
};

const ICONS: Record<string, typeof Brain> = {
  save_memory: Brain,
  web_search: Globe,
  fetch_url: Link2,
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
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
      <Clock className="w-3 h-3" /> planned
    </span>
  );
}

export function ToolsSection() {
  const [tools, setTools] = useState<ToolStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("tools-status");
      if (error) {
        toast.error("Couldn't load tools", { description: error.message });
        setLoading(false);
        return;
      }
      setTools((data?.tools ?? []) as ToolStatus[]);
      setLoading(false);
    })();
  }, []);

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
        {readyCount} of {tools.length} tools active
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
                    key={t.name}
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
                          <StatusBadge status={t.status} />
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
    </div>
  );
}
