import { useEffect, useState } from "react";
import { Brain, Loader2, Tag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

type MemoryRow = {
  id: string;
  content: string | null;
  tags: string[] | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function memorySource(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const username = metadata.telegram_username as string | undefined;
  const source = metadata.source as string | undefined;
  if (username) return `@${username}`;
  if (source === "telegram_group") return "telegram group";
  if (source === "telegram_dm") return "telegram dm";
  if (source === "web") return "web chat";
  return null;
}

export function MemorySection() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("id, content, tags, created_at, metadata")
        .eq("community_id", VIBEY_COMMUNITY_ID)
        .order("created_at", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load memories", { description: error.message });
        setLoading(false);
        return;
      }
      setMemories((data ?? []) as MemoryRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
          <Brain className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">No memories yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Vibey saves memories on its own when something feels worth remembering.
            Try saying "remember that we host hackathons on Fridays."
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {memories.map((m) => {
        const source = memorySource(m.metadata);
        return (
          <div
            key={m.id}
            className="p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors"
          >
            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-mono">
                {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
              </span>
              {source && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  via {source}
                </span>
              )}
              {m.tags && m.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Tag className="w-3 h-3 text-muted-foreground" />
                  {m.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
