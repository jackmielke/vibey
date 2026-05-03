import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VIBE_CODE_RESIDENCY_COMMUNITY_ID } from "@/lib/vibey";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Loader2, Search, MessageSquare, Clock, Save, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// Vibe Code Residency — the community whose members/preferences are managed here.
const COMMUNITY_ID = VIBE_CODE_RESIDENCY_COMMUNITY_ID;

type Member = {
  id: string;
  name: string | null;
  username: string | null;
  telegram_username: string | null;
  telegram_user_id: number | null;
  avatar_url: string | null;
  profile_picture_url: string | null;
  headline: string | null;
};

type Relationship = {
  id: string;
  telegram_user_id: number | null;
  telegram_username: string | null;
  display_name: string | null;
  relationship_notes: string | null;
  interaction_count: number | null;
  last_interaction_at: string | null;
};

type Row = Member & { relationship?: Relationship };

type ChatLog = {
  id: string;
  user_message: string;
  agent_response: string;
  created_at: string;
  telegram_chat_id: number | null;
  telegram_username: string | null;
};

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function activityScore(r: Row): number {
  const count = r.relationship?.interaction_count ?? 0;
  const last = r.relationship?.last_interaction_at ? new Date(r.relationship.last_interaction_at).getTime() : 0;
  // Interaction count dominates; recency as secondary tiebreaker (ms scaled down).
  return count * 1e13 + last;
}

export function RelationshipsSection() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    const { data: memberLinks, error: mErr } = await supabase
      .from("community_members")
      .select("user_id")
      .eq("community_id", COMMUNITY_ID);
    if (mErr) { console.error(mErr); setLoading(false); return; }
    const userIds = (memberLinks ?? []).map((m) => m.user_id);
    if (userIds.length === 0) { setRows([]); setLoading(false); return; }

    const [{ data: users }, { data: rels }] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, username, telegram_username, telegram_user_id, avatar_url, profile_picture_url, headline")
        .in("id", userIds),
      supabase
        .from("vibey_relationships")
        .select("id, telegram_user_id, telegram_username, display_name, relationship_notes, interaction_count, last_interaction_at")
        .eq("community_id", COMMUNITY_ID),
    ]);

    const relsByTgId = new Map<number, Relationship>();
    const relsByTgUser = new Map<string, Relationship>();
    for (const r of (rels ?? []) as Relationship[]) {
      if (r.telegram_user_id != null) relsByTgId.set(Number(r.telegram_user_id), r);
      if (r.telegram_username) relsByTgUser.set(r.telegram_username.toLowerCase(), r);
    }

    const merged: Row[] = ((users ?? []) as Member[]).map((u) => {
      const byId = u.telegram_user_id != null ? relsByTgId.get(Number(u.telegram_user_id)) : undefined;
      const byUser = !byId && u.telegram_username ? relsByTgUser.get(u.telegram_username.toLowerCase()) : undefined;
      return { ...u, relationship: byId ?? byUser };
    });

    // Default sort: most active first (interaction count desc, then last_interaction_at desc, then name)
    merged.sort((a, b) => {
      const diff = activityScore(b) - activityScore(a);
      if (diff !== 0) return diff;
      return (a.name ?? "~").localeCompare(b.name ?? "~");
    });
    setRows(merged);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.username, r.telegram_username, r.headline, r.relationship?.relationship_notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  const withPrefs = filtered.filter((r) => r.relationship?.relationship_notes?.trim());
  const tracked = filtered.filter((r) => r.relationship);
  const withoutPrefs = filtered.filter((r) => !r.relationship?.relationship_notes?.trim());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading members…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs text-muted-foreground font-mono">
          {rows.length} members · {withPrefs.length} with notes · {tracked.length} tracked by Vibey
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, @handle, notes…"
            className="pl-7 h-8 text-sm"
          />
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Most active ({filtered.length})</TabsTrigger>
          <TabsTrigger value="with">With preferences ({withPrefs.length})</TabsTrigger>
          <TabsTrigger value="without">No preferences yet ({withoutPrefs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <PeopleList items={filtered} onSelect={setSelected} />
        </TabsContent>
        <TabsContent value="with" className="mt-4">
          <PeopleList items={withPrefs} onSelect={setSelected} />
        </TabsContent>
        <TabsContent value="without" className="mt-4">
          <PeopleList items={withoutPrefs} onSelect={setSelected} emptyHint="Everyone matched has preferences." />
        </TabsContent>
      </Tabs>

      <UserDrawer
        row={selected}
        onClose={() => setSelected(null)}
        onSaved={(updated) => {
          // patch local row in place so UI reflects change without full reload
          setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          setSelected(updated);
        }}
      />
    </div>
  );
}

function PeopleList({
  items,
  onSelect,
  emptyHint = "Nobody matches.",
}: {
  items: Row[];
  onSelect: (r: Row) => void;
  emptyHint?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyHint}</p>;
  }
  return (
    <ul className="divide-y divide-border border border-border rounded">
      {items.map((r) => {
        const avatar = r.profile_picture_url || r.avatar_url || undefined;
        const handle = r.telegram_username || r.username;
        const rel = r.relationship;
        const hasNotes = !!rel?.relationship_notes?.trim();
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={avatar} alt={r.name ?? "member"} />
                <AvatarFallback className="text-xs font-mono">{initials(r.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{r.name ?? "Unnamed"}</span>
                  {handle && <span className="text-xs text-muted-foreground font-mono">@{handle}</span>}
                  {hasNotes ? (
                    <Badge variant="default" className="font-mono text-[10px] uppercase">notes</Badge>
                  ) : rel ? (
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase">tracked</Badge>
                  ) : (
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">new</Badge>
                  )}
                </div>
                {r.headline && <p className="text-xs text-muted-foreground truncate">{r.headline}</p>}
                {hasNotes && (
                  <p className="text-xs whitespace-pre-wrap text-foreground/80 mt-1 line-clamp-2">{rel!.relationship_notes}</p>
                )}
                {rel && (rel.interaction_count != null || rel.last_interaction_at) && (
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono pt-0.5">
                    {rel.interaction_count != null && (
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{rel.interaction_count} msgs</span>
                    )}
                    {rel.last_interaction_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        last {formatDistanceToNow(new Date(rel.last_interaction_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function UserDrawer({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: (r: Row) => void;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [chats, setChats] = useState<ChatLog[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  useEffect(() => {
    if (!row) return;
    setNotes(row.relationship?.relationship_notes ?? "");
    // Load recent chat history with Vibey for this user (via telegram identifiers)
    (async () => {
      setChatsLoading(true);
      let q = supabase
        .from("agent_chat_logs")
        .select("id, user_message, agent_response, created_at, telegram_chat_id, telegram_username")
        .eq("community_id", COMMUNITY_ID)
        .order("created_at", { ascending: false })
        .limit(30);
      if (row.telegram_user_id != null) {
        q = q.eq("telegram_user_id", row.telegram_user_id);
      } else if (row.telegram_username) {
        q = q.ilike("telegram_username", row.telegram_username);
      } else {
        setChats([]);
        setChatsLoading(false);
        return;
      }
      const { data, error } = await q;
      if (error) {
        console.error(error);
        setChats([]);
      } else {
        setChats((data ?? []) as ChatLog[]);
      }
      setChatsLoading(false);
    })();
  }, [row]);

  if (!row) return null;

  const avatar = row.profile_picture_url || row.avatar_url || undefined;
  const handle = row.telegram_username || row.username;
  const rel = row.relationship;

  async function saveNotes() {
    if (!row) return;
    setSaving(true);
    let updatedRel: Relationship | null = null;
    if (rel?.id) {
      const { data, error } = await supabase
        .from("vibey_relationships")
        .update({ relationship_notes: notes })
        .eq("id", rel.id)
        .select("id, telegram_user_id, telegram_username, display_name, relationship_notes, interaction_count, last_interaction_at")
        .single();
      if (error) {
        toast.error("Couldn't save preferences", { description: error.message });
        setSaving(false);
        return;
      }
      updatedRel = data as Relationship;
    } else {
      // Create a new relationship row for this user
      const agentId = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // Vibey agent
      const { data, error } = await supabase
        .from("vibey_relationships")
        .insert({
          community_id: COMMUNITY_ID,
          agent_id: agentId,
          telegram_user_id: row.telegram_user_id,
          telegram_username: row.telegram_username,
          display_name: row.name,
          relationship_notes: notes,
        })
        .select("id, telegram_user_id, telegram_username, display_name, relationship_notes, interaction_count, last_interaction_at")
        .single();
      if (error) {
        toast.error("Couldn't create preferences", { description: error.message });
        setSaving(false);
        return;
      }
      updatedRel = data as Relationship;
    }
    setSaving(false);
    toast.success("Preferences saved");
    onSaved({ ...row, relationship: updatedRel ?? undefined });
  }

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={avatar} alt={row.name ?? "member"} />
              <AvatarFallback className="font-mono">{initials(row.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate">{row.name ?? "Unnamed"}</SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {handle ? `@${handle}` : "no handle"}
                {row.headline ? ` · ${row.headline}` : ""}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Activity */}
          {rel && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {rel.interaction_count ?? 0} msgs
              </span>
              {rel.last_interaction_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  last {formatDistanceToNow(new Date(rel.last_interaction_at), { addSuffix: true })}
                </span>
              )}
            </div>
          )}

          {/* Preferences / notes editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Preferences</h3>
              <Button size="sm" onClick={saveNotes} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Save
              </Button>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What does Vibey know about this person? Communication style, interests, context, what they're working on, how to greet them, things to avoid…"
              rows={10}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Private to Vibey for this user — used as context in 1:1 conversations.
            </p>
          </div>

          {/* Chat history with Vibey */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Chat history with Vibey
              <a
                href="/conversations"
                className="text-[10px] text-primary inline-flex items-center gap-0.5 hover:underline normal-case font-sans"
              >
                view all <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </h3>
            {chatsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
                <Loader2 className="h-3 w-3 animate-spin mr-2" /> Loading…
              </div>
            ) : chats.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No conversations with Vibey yet.</p>
            ) : (
              <ul className="space-y-3">
                {chats.map((c) => (
                  <li key={c.id} className="border border-border rounded p-2 space-y-1.5">
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      {c.telegram_chat_id != null && c.telegram_chat_id < 0 && " · group"}
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground font-mono">them:</span>{" "}
                      <span className="whitespace-pre-wrap">{c.user_message}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-primary font-mono">vibey:</span>{" "}
                      <span className="whitespace-pre-wrap">{c.agent_response}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
