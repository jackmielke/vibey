import { useEffect, useState } from "react";
import { Brain, Loader2, Tag, Plus, Trash2, Pencil, Check, X, Share2 } from "lucide-react";
import { formatMemoryForTelegram, buildTelegramShareUrl } from "@/lib/shareMemory";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

type MemoryRow = {
  id: string;
  title: string | null;
  content: string | null;
  tags: string[] | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
};

type AuthorInfo = {
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function memorySource(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const source = metadata.source as string | undefined;
  if (source === "telegram_group") return "telegram group";
  if (source === "telegram_dm") return "telegram dm";
  if (source === "telegram_agent") return "telegram";
  if (source === "web") return "web chat";
  return null;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function MemorySection() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function loadMemories() {
    const { data, error } = await supabase
      .from("memories")
      .select("id, title, content, tags, created_at, metadata, created_by")
      .eq("community_id", VIBEY_COMMUNITY_ID)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error("Couldn't load memories", { description: error.message });
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as MemoryRow[];
    setMemories(rows);
    setLoading(false);

    // Resolve authors: by created_by uuid OR by metadata.telegram_user_id /
    // telegram_username. Batch-fetch.
    const userIds = new Set<string>();
    const tgIds = new Set<number>();
    const tgUsernames = new Set<string>();
    for (const m of rows) {
      if (m.created_by) userIds.add(m.created_by);
      const meta = m.metadata ?? {};
      const tid = (meta as { telegram_user_id?: number }).telegram_user_id;
      const tuser = (meta as { telegram_username?: string }).telegram_username;
      if (typeof tid === "number") tgIds.add(tid);
      if (typeof tuser === "string" && tuser) tgUsernames.add(tuser.toLowerCase());
    }

    const cols = "id, name, username, telegram_username, telegram_user_id, telegram_photo_url, avatar_url, profile_picture_url";
    const lookup: Record<string, AuthorInfo> = {};

    const toInfo = (row: Record<string, unknown>): AuthorInfo => ({
      name: (row.name as string) ?? null,
      username: (row.telegram_username as string) ?? (row.username as string) ?? null,
      avatar_url:
        (row.telegram_photo_url as string) ??
        (row.avatar_url as string) ??
        (row.profile_picture_url as string) ??
        null,
    });

    if (userIds.size) {
      const { data: u } = await supabase.from("users").select(cols).in("id", Array.from(userIds));
      for (const row of (u ?? []) as Record<string, unknown>[]) {
        lookup[`id:${row.id}`] = toInfo(row);
      }
    }
    if (tgIds.size) {
      const { data: u } = await supabase
        .from("users")
        .select(cols)
        .in("telegram_user_id", Array.from(tgIds));
      for (const row of (u ?? []) as Record<string, unknown>[]) {
        lookup[`tgid:${row.telegram_user_id}`] = toInfo(row);
      }
    }
    if (tgUsernames.size) {
      const { data: u } = await supabase
        .from("users")
        .select(cols)
        .in("telegram_username", Array.from(tgUsernames));
      for (const row of (u ?? []) as Record<string, unknown>[]) {
        const tu = row.telegram_username as string | null;
        if (tu) lookup[`tguser:${tu.toLowerCase()}`] = toInfo(row);
      }
    }
    setAuthors(lookup);
  }

  function authorFor(m: MemoryRow): AuthorInfo | null {
    if (m.created_by && authors[`id:${m.created_by}`]) return authors[`id:${m.created_by}`];
    const meta = m.metadata ?? {};
    const tid = (meta as { telegram_user_id?: number }).telegram_user_id;
    const tuser = (meta as { telegram_username?: string }).telegram_username;
    if (typeof tid === "number" && authors[`tgid:${tid}`]) return authors[`tgid:${tid}`];
    if (typeof tuser === "string" && authors[`tguser:${tuser.toLowerCase()}`]) {
      return authors[`tguser:${tuser.toLowerCase()}`];
    }
    if (typeof tuser === "string") return { name: null, username: tuser, avatar_url: null };
    return null;
  }

  useEffect(() => {
    loadMemories();
  }, []);

  async function handleAdd() {
    if (!newContent.trim()) return;
    setSaving(true);
    const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("memories").insert({
      community_id: VIBEY_COMMUNITY_ID,
      title: newTitle.trim() || null,
      content: newContent.trim(),
      tags: tags.length ? tags : null,
      metadata: { source: "admin_panel" },
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save memory", { description: error.message });
      return;
    }
    setNewTitle("");
    setNewContent("");
    setNewTags("");
    setComposerOpen(false);
    toast.success("memory saved");
    loadMemories();
  }

  function startEdit(m: MemoryRow) {
    setEditingId(m.id);
    setEditTitle(m.title ?? "");
    setEditContent(m.content ?? "");
    setEditTags((m.tags ?? []).join(", "));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
    setEditTags("");
  }

  async function saveEdit() {
    if (!editingId || !editContent.trim()) return;
    setEditSaving(true);
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    const nextTitle = editTitle.trim() || null;
    const { error } = await supabase
      .from("memories")
      .update({
        title: nextTitle,
        content: editContent.trim(),
        tags: tags.length ? tags : null,
      })
      .eq("id", editingId);
    setEditSaving(false);
    if (error) {
      toast.error("Couldn't update memory", { description: error.message });
      return;
    }
    setMemories((prev) =>
      prev.map((m) =>
        m.id === editingId
          ? { ...m, title: nextTitle, content: editContent.trim(), tags: tags.length ? tags : null }
          : m,
      ),
    );
    toast.success("memory updated");
    cancelEdit();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    const prev = memories;
    setMemories((m) => m.filter((x) => x.id !== id));
    setDeleteId(null);
    // Use .select() so we can detect when RLS silently blocks the delete
    // (Supabase returns success with 0 rows instead of erroring).
    const { data, error } = await supabase
      .from("memories")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      toast.error("Couldn't delete", { description: error.message });
      setMemories(prev);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("Couldn't delete", {
        description: "You don't have permission to delete this memory.",
      });
      setMemories(prev);
      return;
    }
    toast.success("memory deleted");
  }

  return (
    <div className="space-y-3 max-w-2xl w-full min-w-0 overflow-hidden">
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
          <Input
            placeholder="title (optional, short headline)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="text-sm"
          />
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
            const isEditing = editingId === m.id;
            const author = authorFor(m);
            const displayName = author?.name || (author?.username ? `@${author.username}` : "vibey");
            return (
              <div
                key={m.id}
                className="group p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="title (optional)"
                      className="text-sm"
                    />
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="resize-none text-sm"
                    />
                    <Input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="tags (comma separated)"
                      className="font-mono text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="w-3.5 h-3.5 mr-1" /> cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        disabled={editSaving || !editContent.trim()}
                      >
                        {editSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1" /> save
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                      {author?.avatar_url ? (
                        <AvatarImage src={author.avatar_url} alt={displayName} />
                      ) : null}
                      <AvatarFallback className="text-[10px] font-mono bg-muted">
                        {initials(author?.name ?? author?.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs font-medium">{displayName}</span>
                            {author?.username && author?.name && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                @{author.username}
                              </span>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words mt-1">{m.content}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={buildTelegramShareUrl(formatMemoryForTelegram(m))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary p-1"
                            aria-label="Share to Telegram"
                            title="Share to Telegram"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => startEdit(m)}
                            className="text-muted-foreground hover:text-primary p-1"
                            aria-label="Edit memory"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(m.id)}
                            className="text-muted-foreground hover:text-destructive p-1"
                            aria-label="Delete memory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary break-all"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>delete this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              vibey will forget this permanently. this can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
