import { useEffect, useState } from "react";
import { UsersRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type GroupMode = "read_only" | "reply";

type GroupRow = {
  chat_id: number;
  chat_title: string | null;
  enabled: boolean;
  mode: GroupMode;
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
        .select("chat_id, chat_title, enabled, mode, enabled_at, enabled_by, added_at")
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

  const persist = async (
    chat_id: number,
    patch: Partial<GroupRow>,
    optimistic: Partial<GroupRow>,
    successMsg: string,
  ) => {
    setUpdatingId(chat_id);
    const prevSnapshot = groups.find((g) => g.chat_id === chat_id);
    setGroups((prev) =>
      prev.map((g) => (g.chat_id === chat_id ? { ...g, ...optimistic } : g))
    );

    const { data, error } = await supabase
      .from("telegram_group_settings")
      .update(patch)
      .eq("chat_id", chat_id)
      .select("chat_id, chat_title, enabled, mode, enabled_at, enabled_by, added_at")
      .maybeSingle();

    setUpdatingId(null);
    if (error || !data) {
      toast.error("Couldn't update", {
        description: error?.message ?? "No row updated — check admin access.",
      });
      if (prevSnapshot) {
        setGroups((prev) =>
          prev.map((g) => (g.chat_id === chat_id ? prevSnapshot : g))
        );
      }
      return;
    }
    setGroups((prev) => prev.map((g) => (g.chat_id === chat_id ? (data as GroupRow) : g)));
    toast.success(successMsg);
  };

  const toggleEnabled = (chat_id: number, next: boolean) =>
    persist(
      chat_id,
      next
        ? { enabled: true, enabled_at: new Date().toISOString(), enabled_by: "admin-ui", disabled_at: null } as never
        : { enabled: false, disabled_at: new Date().toISOString() } as never,
      { enabled: next },
      next ? "Vibey listening in group" : "Vibey muted in group",
    );

  const toggleMode = (chat_id: number, allowReply: boolean) => {
    const mode: GroupMode = allowReply ? "reply" : "read_only";
    persist(
      chat_id,
      { mode } as never,
      { mode },
      mode === "reply" ? "Vibey will reply when @mentioned" : "Vibey set to read-only",
    );
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
          className="p-4 rounded-lg bg-card border border-border space-y-3"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
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
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {g.enabled ? "on" : "off"}
                </span>
                <Switch
                  checked={g.enabled}
                  onCheckedChange={(checked) => toggleEnabled(g.chat_id, checked)}
                  disabled={updatingId === g.chat_id}
                />
              </div>
            </div>
          </div>

          {g.enabled && (
            <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/50">
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {g.mode === "reply" ? "Reply mode" : "Read-only mode"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {g.mode === "reply"
                    ? "Vibey replies when @mentioned or replied to."
                    : "Vibey listens silently — no replies, ever."}
                </p>
              </div>
              <Switch
                checked={g.mode === "reply"}
                onCheckedChange={(checked) => toggleMode(g.chat_id, checked)}
                disabled={updatingId === g.chat_id}
              />
            </div>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-2">
        Off = Vibey ignores the group entirely. On + read-only = listens for context but never sends a message.
        On + reply = answers when @mentioned or replied to. You can also send{" "}
        <span className="font-mono">/vibey on</span> or <span className="font-mono">/vibey off</span> in the group.
      </p>
    </div>
  );
}
