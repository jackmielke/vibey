import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Search, MessageSquare, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Vibe Code Residency
const COMMUNITY_ID = "4202857f-13fd-4407-8906-3f8ffe63e510";

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

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function RelationshipsSection() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Pull all member user_ids for the community, then fetch user profiles + relationships in parallel.
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

      // Index relationships by telegram_user_id and telegram_username for matching.
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

      // Sort: name ASC, nulls last
      merged.sort((a, b) => (a.name ?? "~").localeCompare(b.name ?? "~"));
      setRows(merged);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.username, r.telegram_username, r.headline, r.relationship?.relationship_notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, query]);

  const withPrefs = filtered.filter((r) => r.relationship);
  const withoutPrefs = filtered.filter((r) => !r.relationship);

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
          {rows.length} members · {rows.filter((r) => r.relationship).length} with preferences ·{" "}
          {rows.filter((r) => !r.relationship).length} without
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
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
          <TabsTrigger value="with">With preferences ({withPrefs.length})</TabsTrigger>
          <TabsTrigger value="without">No preferences yet ({withoutPrefs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <PeopleList items={filtered} />
        </TabsContent>
        <TabsContent value="with" className="mt-4">
          <PeopleList items={withPrefs} />
        </TabsContent>
        <TabsContent value="without" className="mt-4">
          <PeopleList items={withoutPrefs} emptyHint="Everyone matched has preferences." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PeopleList({ items, emptyHint = "Nobody matches." }: { items: Row[]; emptyHint?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{emptyHint}</p>;
  }
  return (
    <ul className="divide-y divide-border border border-border rounded">
      {items.map((r) => {
        const avatar = r.profile_picture_url || r.avatar_url || undefined;
        const handle = r.telegram_username || r.username;
        const rel = r.relationship;
        return (
          <li key={r.id} className="flex items-start gap-3 px-3 py-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={avatar} alt={r.name ?? "member"} />
              <AvatarFallback className="text-xs font-mono">{initials(r.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{r.name ?? "Unnamed"}</span>
                {handle && <span className="text-xs text-muted-foreground font-mono">@{handle}</span>}
                {rel ? (
                  <Badge variant="default" className="font-mono text-[10px] uppercase">tracked</Badge>
                ) : (
                  <Badge variant="secondary" className="font-mono text-[10px] uppercase">no prefs</Badge>
                )}
              </div>
              {r.headline && <p className="text-xs text-muted-foreground truncate">{r.headline}</p>}
              {rel?.relationship_notes && (
                <p className="text-xs whitespace-pre-wrap text-foreground/80 mt-1">{rel.relationship_notes}</p>
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
          </li>
        );
      })}
    </ul>
  );
}
