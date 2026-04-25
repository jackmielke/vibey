import { useEffect, useState } from "react";
import { UsersRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type GroupRow = {
  chat_id: number;
  chat_title: string | null;
  enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
  added_at: string;
};

export function GroupsSection() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("telegram_group_settings")
        .select("chat_id, chat_title, enabled, enabled_at, enabled_by, added_at")
        .order("added_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load groups", { description: error.message });
      } else {
        setGroups((data ?? []) as GroupRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (chat_id: number, next: boolean) => {
    setUpdatingId(chat_id);
    // optimistic
    setGroups((prev) =>
      prev.map((g) => (g.chat_id === chat_id ? { ...g, enabled: next } : g))
    );

    const patch = next
      ? { enabled: true, enabled_at: new Date().toISOString(), enabled_by: "admin-ui", disabled_at: null }
      : { enabled: false, disabled_at: new Date().toISOString() };

    const { error } = await supabase
      .from("telegram_group_settings")
      .update(patch)
      .eq("chat_id", chat_id);

    setUpdatingId(null);
    if (error) {
      toast.error("Couldn't update", { description: error.message });
      // rollback
      setGroups((prev) =>
        prev.map((g) => (g.chat_id === chat_id ? { ...g, enabled: !next } : g))
      );
    } else {
      toast.success(next ? "Vibey enabled in group" : "Vibey muted in group");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
          <UsersRound className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No group chats yet</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Add <span className="font-mono">@vibey_ai_bot</span> to a Telegram group, send any message,
          and the group will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {groups.map((g) => (
        <div
          key={g.chat_id}
          className="flex items-center justify-between p-4 rounded-lg bg-card border border-border"
        >
          <div className="min-w-0 pr-4">
            <p className="text-sm font-medium truncate">
              {g.chat_title ?? `Chat ${g.chat_id}`}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{g.chat_id}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Added {formatDistanceToNow(new Date(g.added_at), { addSuffix: true })}
              {g.enabled && g.enabled_at && (
                <> · enabled {formatDistanceToNow(new Date(g.enabled_at), { addSuffix: true })}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {updatingId === g.chat_id && (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={g.enabled}
              onCheckedChange={(checked) => toggle(g.chat_id, checked)}
              disabled={updatingId === g.chat_id}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-2">
        When enabled, Vibey responds when @-mentioned or replied to. You can also send{" "}
        <span className="font-mono">/vibey on</span> or <span className="font-mono">/vibey off</span>{" "}
        in the group itself.
      </p>
    </div>
  );
}
