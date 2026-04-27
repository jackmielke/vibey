import { useEffect, useState } from "react";
import { Brain, Loader2, Tag, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

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
  if (source === "telegram_agent") return "telegram";
  if (source === "web") return "web chat";
  return null;
}

export function MemorySection() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadMemories() {
    const { data, error } = await supabase
      .from("memories")
      .select("id, content, tags, created_at, metadata")
      .eq("community_id", VIBEY_COMMUNITY_ID)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Couldn't load memories", { description: error.message });
      setLoading(false);
      return;
    }
    setMemories((data ?? []) as MemoryRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadMemories();
  }, []);

  async function handleAdd() {
    if (!newContent.trim()) return;
    setSaving(true);
    const tags = newTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const { error } = await supabase.from("memories").insert({
      community_id: VIBEY_COMMUNITY_ID,
      content: newContent.trim(),
      tags: tags.length ? tags : null,
      metadata: { source: "admin_panel" },
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save memory", { description: error.message });
      return;
    }
    setNewContent("");
    setNewTags("");
    setComposerOpen(false);
    toast.success("memory saved");
    loadMemories();
  }

  async function handleDelete(id: string) {
    const prev = memories;
    setMemories((m) => m.filter((x) => x.id !== id));
    const { error } = await supabase.from("memories").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't delete", { description: error.message });
      setMemories(prev);
    }
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {loading ? "loading…" : `${memories.length} memories`}
        </div>
        <Button
          size="sm"
          variant={composerOpen ? "secondary" : "default"}
          onClick={() => setComposerOpen((o) => !o)}
        >
          <Plus className="w-4 h-4 mr-1" />
          {composerOpen ? "cancel" : "add memory"}
        </Button>
      </div>

      {composerOpen && (
        <div className="p-3 rounded-lg bg-card border border-border space-y-2">
          <Textarea
            placeholder="what should vibey remember?"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <Input
            placeholder="tags (comma separated, optional)"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAdd} disabled={saving || !newContent.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "save"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : memories.length === 0 ? (
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
      ) : (
        <div className="space-y-2">
          {memories.map((m) => {
            const source = memorySource(m.metadata);
            return (
              <div
                key={m.id}
                className="group p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm whitespace-pre-wrap flex-1">{m.content}</p>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                    aria-label="Delete memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
      )}
    </div>
  );
}
