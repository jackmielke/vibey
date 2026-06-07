import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Coins, Loader2, MessagesSquare, Phone, ShieldCheck, Sparkles, UsersRound, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { formatCredits, formatTokens } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "read_only" | "reply";
type Filter = "all" | "groups" | "dms";

type UserLite = {
  id: string;
  name: string | null;
  telegram_username: string | null;
  telegram_user_id: number | null;
  telegram_photo_url: string | null;
  avatar_url: string | null;
  is_vibe_resident: boolean | null;
  is_claimed: boolean | null;
  world_id_verified: boolean | null;
  phone_verified: boolean | null;
};

type ChatLog = {
  id: string;
  user_message: string;
  agent_response: string;
  created_at: string;
  session_key: string | null;
  telegram_chat_id: number | null;
  telegram_user_id: number | null;
  telegram_username: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_credits: number | null;
  openrouter_model: string | null;
};

type GroupRow = {
  chat_id: number;
  chat_title: string | null;
  enabled: boolean;
  mode: Mode;
  enabled_at: string | null;
  added_at: string;
};

type DmRow = {
  telegram_user_id: number;
  telegram_username: string | null;
  display_name: string | null;
  enabled: boolean;
  mode: Mode;
};

type DmConversation = {
  telegramUserId: number;
  label: string;
  username: string | null;
  messageCount: number;
  lastMessageAt: string;
  lastPreview: string;
  totalTokens: number;
  totalCost: number;
  hasReplies: boolean;
  setting: DmRow | null;
  user: UserLite | null;
};

type GroupConversation = GroupRow & {
  lastMessageAt: string;
  lastPreview: string;
  messageCount: number;
};

type ConvItem =
  | { kind: "group"; key: string; lastMessageAt: string; group: GroupConversation }
  | { kind: "dm"; key: string; lastMessageAt: string; dm: DmConversation };

const PAGE_SIZE = 500;

function initialsOf(label: string) {
  return label.replace(/^@/, "").split(/[\s_·]+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function ConversationsSection() {
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const filter: Filter = rawTab === "groups" ? "groups" : rawTab === "dms" ? "dms" : "all";
  const setFilter = (next: Filter) => {
    const p = new URLSearchParams(params);
    p.set("tab", next);
    setParams(p, { replace: true });
  };

  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [dmSettings, setDmSettings] = useState<DmRow[]>([]);
  const [usersByTgId, setUsersByTgId] = useState<Map<number, UserLite>>(new Map());
  const [usersByTgUsername, setUsersByTgUsername] = useState<Map<string, UserLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<
    | { kind: "group"; chatId: number }
    | { kind: "dm"; telegramUserId: number }
    | null
  >(null);
  const [profileLookup, setProfileLookup] = useState<
    { telegramUserId?: number | null; telegramUsername?: string | null } | null
  >(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: logsData, error: logsErr }, { data: groupsData }, { data: dmData }, { data: usersData }] =
        await Promise.all([
          supabase
            .from("agent_chat_logs")
            .select("id, user_message, agent_response, created_at, session_key, telegram_chat_id, telegram_user_id, telegram_username, prompt_tokens, completion_tokens, total_tokens, cost_credits, openrouter_model")
            .order("created_at", { ascending: false })
            .limit(PAGE_SIZE),
          supabase.from("telegram_group_settings")
            .select("chat_id, chat_title, enabled, mode, enabled_at, added_at")
            .order("added_at", { ascending: false }),
          supabase.from("telegram_dm_settings")
            .select("telegram_user_id, telegram_username, display_name, enabled, mode"),
          supabase.from("users")
            .select("id, name, telegram_username, telegram_user_id, telegram_photo_url, avatar_url, is_vibe_resident, is_claimed, world_id_verified, phone_verified")
            .or("telegram_username.not.is.null,telegram_user_id.not.is.null"),
        ]);

      if (cancelled) return;
      if (logsErr) toast.error("Couldn't load conversations", { description: logsErr.message });

      const byId = new Map<number, UserLite>();
      const byUsername = new Map<string, UserLite>();
      for (const u of (usersData ?? []) as UserLite[]) {
        if (u.telegram_user_id) byId.set(Number(u.telegram_user_id), u);
        if (u.telegram_username) byUsername.set(u.telegram_username.toLowerCase(), u);
      }
      setUsersByTgId(byId);
      setUsersByTgUsername(byUsername);
      setLogs((logsData ?? []) as ChatLog[]);
      setGroups((groupsData ?? []) as GroupRow[]);
      setDmSettings((dmData ?? []) as DmRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const persistGroup = async (chatId: number, patch: Partial<GroupRow>) => {
    const key = `g:${chatId}`;
    setUpdatingKey(key);
    const snap = groups.find((g) => g.chat_id === chatId);
    setGroups((prev) => prev.map((g) => (g.chat_id === chatId ? { ...g, ...patch } : g)));
    const { data, error } = await supabase
      .from("telegram_group_settings")
      .update(patch as never)
      .eq("chat_id", chatId)
      .select("chat_id, chat_title, enabled, mode, enabled_at, added_at")
      .maybeSingle();
    setUpdatingKey(null);
    if (error || !data) {
      toast.error("Couldn't update group", { description: error?.message ?? "No row updated — check admin access." });
      if (snap) setGroups((prev) => prev.map((g) => (g.chat_id === chatId ? snap : g)));
      return;
    }
    setGroups((prev) => prev.map((g) => (g.chat_id === chatId ? (data as GroupRow) : g)));
  };

  const persistDm = async (
    telegramUserId: number,
    username: string | null,
    displayName: string | null,
    patch: Partial<DmRow>,
  ) => {
    const key = `d:${telegramUserId}`;
    setUpdatingKey(key);
    const existing = dmSettings.find((d) => d.telegram_user_id === telegramUserId);
    const optimistic: DmRow = {
      telegram_user_id: telegramUserId,
      telegram_username: existing?.telegram_username ?? username,
      display_name: existing?.display_name ?? displayName,
      enabled: existing?.enabled ?? true,
      mode: existing?.mode ?? "reply",
      ...patch,
    } as DmRow;
    setDmSettings((prev) => {
      const others = prev.filter((d) => d.telegram_user_id !== telegramUserId);
      return [...others, optimistic];
    });

    const { data, error } = await supabase
      .from("telegram_dm_settings")
      .upsert(
        {
          telegram_user_id: telegramUserId,
          telegram_username: username,
          display_name: displayName,
          ...patch,
        } as never,
        { onConflict: "telegram_user_id" },
      )
      .select("telegram_user_id, telegram_username, display_name, enabled, mode")
      .maybeSingle();

    setUpdatingKey(null);
    if (error || !data) {
      toast.error("Couldn't update DM", { description: error?.message ?? "No row written — check admin access." });
      setDmSettings((prev) => {
        const others = prev.filter((d) => d.telegram_user_id !== telegramUserId);
        return existing ? [...others, existing] : others;
      });
      return;
    }
    setDmSettings((prev) => {
      const others = prev.filter((d) => d.telegram_user_id !== telegramUserId);
      return [...others, data as DmRow];
    });
  };

  // ── Build group conversations w/ last activity ──
  const groupConversations = useMemo<GroupConversation[]>(() => {
    const stats = new Map<number, { lastMessageAt: string; lastPreview: string; count: number }>();
    for (const log of logs) {
      if (log.telegram_chat_id === null || log.telegram_chat_id >= 0) continue;
      const cur = stats.get(log.telegram_chat_id);
      if (!cur) {
        stats.set(log.telegram_chat_id, {
          lastMessageAt: log.created_at,
          lastPreview: log.user_message,
          count: 1,
        });
      } else {
        cur.count += 1;
      }
    }
    return groups.map((g) => {
      const s = stats.get(g.chat_id);
      return {
        ...g,
        lastMessageAt: s?.lastMessageAt ?? g.added_at,
        lastPreview: s?.lastPreview ?? "",
        messageCount: s?.count ?? 0,
      };
    });
  }, [groups, logs]);

  const dmConversations = useMemo<DmConversation[]>(() => {
    const settingsById = new Map(dmSettings.map((d) => [d.telegram_user_id, d]));
    const map = new Map<number, DmConversation>();
    for (const log of logs) {
      if (log.telegram_chat_id === null || log.telegram_chat_id < 0) continue;
      const tgUserId = log.telegram_user_id ?? log.telegram_chat_id;
      const existing = map.get(tgUserId);
      if (existing) {
        existing.messageCount += 1;
        existing.totalTokens += log.total_tokens ?? 0;
        existing.totalCost += Number(log.cost_credits ?? 0);
        if (log.agent_response) existing.hasReplies = true;
        continue;
      }
      const user = usersByTgId.get(tgUserId)
        ?? (log.telegram_username ? usersByTgUsername.get(log.telegram_username.toLowerCase()) ?? null : null);
      const setting = settingsById.get(tgUserId) ?? null;
      const label = user?.name ?? log.telegram_username ?? setting?.display_name ?? `User ${tgUserId}`;
      map.set(tgUserId, {
        telegramUserId: tgUserId,
        label,
        username: log.telegram_username ?? setting?.telegram_username ?? null,
        messageCount: 1,
        lastMessageAt: log.created_at,
        lastPreview: log.user_message,
        totalTokens: log.total_tokens ?? 0,
        totalCost: Number(log.cost_credits ?? 0),
        hasReplies: !!log.agent_response,
        setting,
        user,
      });
    }
    for (const s of dmSettings) {
      if (map.has(s.telegram_user_id)) continue;
      const user = usersByTgId.get(s.telegram_user_id)
        ?? (s.telegram_username ? usersByTgUsername.get(s.telegram_username.toLowerCase()) ?? null : null);
      map.set(s.telegram_user_id, {
        telegramUserId: s.telegram_user_id,
        label: user?.name ?? s.display_name ?? s.telegram_username ?? `User ${s.telegram_user_id}`,
        username: s.telegram_username,
        messageCount: 0,
        lastMessageAt: "1970-01-01",
        lastPreview: "",
        totalTokens: 0,
        totalCost: 0,
        hasReplies: false,
        setting: s,
        user,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }, [logs, dmSettings, usersByTgId, usersByTgUsername]);

  // ── Unified, sorted list of all conversations ──
  const allItems = useMemo<ConvItem[]>(() => {
    const items: ConvItem[] = [
      ...groupConversations.map<ConvItem>((g) => ({
        kind: "group",
        key: `g:${g.chat_id}`,
        lastMessageAt: g.lastMessageAt,
        group: g,
      })),
      ...dmConversations.map<ConvItem>((d) => ({
        kind: "dm",
        key: `d:${d.telegramUserId}`,
        lastMessageAt: d.lastMessageAt,
        dm: d,
      })),
    ];
    return items.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }, [groupConversations, dmConversations]);

  const filteredItems = useMemo(() => {
    if (filter === "groups") return allItems.filter((i) => i.kind === "group");
    if (filter === "dms") return allItems.filter((i) => i.kind === "dm");
    return allItems;
  }, [allItems, filter]);

  const threadMessages = useMemo(() => {
    if (!selected) return [];
    return logs
      .filter((l) => {
        if (selected.kind === "group") return l.telegram_chat_id === selected.chatId;
        return l.telegram_chat_id !== null && l.telegram_chat_id > 0
          && (l.telegram_user_id ?? l.telegram_chat_id) === selected.telegramUserId;
      })
      .slice()
      .reverse();
  }, [logs, selected]);

  useEffect(() => {
    if (!selected || threadMessages.length === 0) return;
    const id = requestAnimationFrame(() => threadEndRef.current?.scrollIntoView({ block: "end" }));
    return () => cancelAnimationFrame(id);
  }, [selected, threadMessages.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const counts = {
    all: allItems.length,
    groups: groupConversations.length,
    dms: dmConversations.length,
  };

  // ── List item renderers ──
  const renderRow = (item: ConvItem) => {
    const isSelected =
      selected?.kind === item.kind &&
      ((selected.kind === "group" && item.kind === "group" && selected.chatId === item.group.chat_id) ||
        (selected.kind === "dm" && item.kind === "dm" && selected.telegramUserId === item.dm.telegramUserId));

    if (item.kind === "group") {
      const g = item.group;
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => setSelected({ kind: "group", chatId: g.chat_id })}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded-lg border transition-colors flex items-start gap-3 min-w-0",
            isSelected
              ? "bg-primary/10 border-primary/40"
              : "bg-card border-border hover:bg-muted/40",
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <UsersRound className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{g.chat_title ?? `Chat ${g.chat_id}`}</p>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                {g.lastMessageAt !== g.added_at || g.messageCount > 0
                  ? formatDistanceToNow(new Date(g.lastMessageAt), { addSuffix: false })
                  : "—"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {g.lastPreview || <span className="italic">group · {g.messageCount} msgs</span>}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full", g.enabled ? "bg-primary" : "bg-muted-foreground/30")} />
              {g.enabled ? (g.mode === "reply" ? "reply" : "read-only") : "off"}
            </p>
          </div>
        </button>
      );
    }

    const c = item.dm;
    const enabled = c.setting?.enabled ?? true;
    const mode: Mode = c.setting?.mode ?? (c.hasReplies ? "reply" : "read_only");
    const isExplicit = !!c.setting;
    const photoUrl = c.user?.telegram_photo_url || c.user?.avatar_url || undefined;
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => setSelected({ kind: "dm", telegramUserId: c.telegramUserId })}
        className={cn(
          "w-full text-left px-3 py-2.5 rounded-lg border transition-colors flex items-start gap-3 min-w-0",
          isSelected
            ? "bg-primary/10 border-primary/40"
            : "bg-card border-border hover:bg-muted/40",
        )}
      >
        <Avatar className="h-10 w-10 rounded-lg ring-1 ring-border shrink-0">
          {photoUrl && <AvatarImage src={photoUrl} alt={c.label} />}
          <AvatarFallback className="rounded-lg text-[11px] font-mono">{initialsOf(c.label)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium truncate">{c.label}</p>
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {c.messageCount > 0 ? formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: false }) : "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastPreview || (c.username ? `@${c.username}` : "—")}</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", enabled ? "bg-primary" : "bg-muted-foreground/30")} />
            {enabled ? (mode === "reply" ? "reply" : "read-only") : "off"}
            {!isExplicit && <span className="italic opacity-70">· inferred</span>}
          </p>
        </div>
      </button>
    );
  };

  const FilterBar = (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border w-fit">
      {(["all", "groups", "dms"] as Filter[]).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => setFilter(f)}
          className={cn(
            "px-3 py-1 text-xs font-mono uppercase tracking-wider rounded-md transition-colors",
            filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {f === "dms" ? "DMs" : f} <span className="opacity-60">({counts[f]})</span>
        </button>
      ))}
    </div>
  );

  // ── Thread / detail pane ──
  const renderDetail = () => {
    if (!selected) {
      return (
        <div className="hidden md:flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
          <MessagesSquare className="w-8 h-8 mb-3 opacity-40" />
          <p className="text-sm">Select a conversation</p>
        </div>
      );
    }

    const selectedGroup = selected.kind === "group"
      ? groupConversations.find((g) => g.chat_id === selected.chatId) ?? null
      : null;
    const selectedDm = selected.kind === "dm"
      ? dmConversations.find((d) => d.telegramUserId === selected.telegramUserId) ?? null
      : null;
    const headerLabel = selectedGroup?.chat_title ?? selectedDm?.label
      ?? (selected.kind === "group" ? `Group ${selected.chatId}` : `User ${selected.telegramUserId}`);

    const updating = selected.kind === "group"
      ? updatingKey === `g:${selected.chatId}`
      : updatingKey === `d:${selected.telegramUserId}`;

    const enabled = selectedGroup?.enabled
      ?? selectedDm?.setting?.enabled
      ?? true;
    const mode: Mode = selectedGroup?.mode
      ?? selectedDm?.setting?.mode
      ?? (selectedDm?.hasReplies ? "reply" : "read_only");

    return (
      <div className="flex flex-col h-full min-w-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden gap-1.5 -ml-2"
              onClick={() => setSelected(null)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            {selected.kind === "group" ? (
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <UsersRound className="w-4 h-4 text-muted-foreground" />
              </div>
            ) : (() => {
              const url = selectedDm?.user?.telegram_photo_url || selectedDm?.user?.avatar_url || undefined;
              return (
                <Avatar className="h-9 w-9 rounded-lg ring-1 ring-border">
                  {url && <AvatarImage src={url} alt={headerLabel} />}
                  <AvatarFallback className="rounded-lg text-[11px] font-mono">{initialsOf(headerLabel)}</AvatarFallback>
                </Avatar>
              );
            })()}
            <div className="min-w-0 flex-1">
              {selected.kind === "dm" ? (
                <button
                  type="button"
                  onClick={() =>
                    setProfileLookup({
                      telegramUserId: selectedDm?.telegramUserId ?? null,
                      telegramUsername: selectedDm?.username ?? null,
                    })
                  }
                  className="text-left -mx-1 -my-0.5 px-1 py-0.5 rounded hover:bg-muted/50 transition-colors min-w-0 max-w-full block"
                  title="View profile"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-medium truncate">{headerLabel}</p>
                    {selectedDm?.user?.is_vibe_resident && (
                      <Sparkles className="w-3 h-3 text-primary shrink-0" aria-label="Vibe resident" />
                    )}
                    {selectedDm?.user?.world_id_verified && (
                      <ShieldCheck className="w-3 h-3 text-primary/80 shrink-0" aria-label="World ID verified" />
                    )}
                    {selectedDm?.user?.phone_verified && (
                      <Phone className="w-3 h-3 text-muted-foreground shrink-0" aria-label="Phone verified" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 min-w-0">
                    <TelegramIcon className="w-3 h-3 text-[#229ED9] shrink-0" />
                    <span className="truncate">
                      {selectedDm?.username ? `@${selectedDm.username} · ` : ""}{selected.telegramUserId} · {threadMessages.length} msgs
                    </span>
                  </p>
                </button>
              ) : (
                <>
                  <p className="text-sm font-medium truncate">{headerLabel}</p>
                  <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 min-w-0">
                    <TelegramIcon className="w-3 h-3 text-[#229ED9] shrink-0" />
                    <span className="truncate">
                      {selected.chatId} · {threadMessages.length} msgs
                    </span>
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {updating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {enabled ? "on" : "off"}
                </span>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => {
                    if (selected.kind === "group") {
                      persistGroup(selected.chatId, checked
                        ? { enabled: true, enabled_at: new Date().toISOString() }
                        : { enabled: false });
                    } else if (selectedDm) {
                      persistDm(selectedDm.telegramUserId, selectedDm.username, selectedDm.user?.name ?? null, { enabled: checked });
                    }
                  }}
                  disabled={updating}
                />
              </div>
            </div>
          </div>
          {enabled && (
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/50">
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {mode === "reply" ? "Reply mode" : "Read-only mode"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {selected.kind === "group"
                    ? (mode === "reply" ? "Replies when @mentioned or replied to." : "Listens silently — no replies.")
                    : (mode === "reply" ? "Vibey replies to this person." : "Vibey reads but doesn't reply.")}
                </p>
              </div>
              <Switch
                checked={mode === "reply"}
                onCheckedChange={(checked) => {
                  if (selected.kind === "group") {
                    persistGroup(selected.chatId, { mode: checked ? "reply" : "read_only" });
                  } else if (selectedDm) {
                    persistDm(selectedDm.telegramUserId, selectedDm.username, selectedDm.user?.name ?? null, {
                      mode: checked ? "reply" : "read_only",
                      enabled: true,
                    });
                  }
                }}
                disabled={updating}
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {threadMessages.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No messages yet.</p>
          )}
          {threadMessages.map((m) => (
            <div key={m.id} className="space-y-2">
              <div className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words bg-primary/10 border border-primary/20">
                  {m.user_message}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 font-mono">
                  {m.telegram_username ?? "user"} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                </span>
              </div>
              <div className="flex flex-col items-start">
                {m.agent_response ? (
                  <>
                    <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words bg-card border border-border">
                      {m.agent_response}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-mono">vibey</span>
                      {(m.total_tokens || m.cost_credits) && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono rounded bg-muted px-1.5 py-0.5">
                          <Zap className="w-2.5 h-2.5" />
                          {formatTokens(m.total_tokens)} tok
                          <span className="text-border">/</span>
                          <Coins className="w-2.5 h-2.5" />
                          {formatCredits(Number(m.cost_credits ?? 0))}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60 font-mono italic">vibey didn't reply · observed only</span>
                )}
              </div>
            </div>
          ))}
          <div ref={threadEndRef} aria-hidden="true" />
        </div>
      </div>
    );
  };

  // ── Layout ──
  return (
    <div className="space-y-3 w-full min-w-0">
      {/* On mobile, hide list when a thread is selected (Telegram-mobile style) */}
      <div className={cn("space-y-3", selected && "hidden md:block")}>{FilterBar}</div>

      <div className="md:grid md:grid-cols-[minmax(280px,340px)_1fr] md:gap-4 md:border md:border-border md:rounded-lg md:overflow-hidden md:h-[calc(100vh-220px)] md:min-h-[480px]">
        {/* LIST */}
        <div
          className={cn(
            "space-y-1.5 md:overflow-y-auto md:p-2 md:border-r md:border-border md:bg-card/30",
            selected && "hidden md:block",
          )}
        >
          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <MessagesSquare className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No conversations</p>
            </div>
          )}
          {filteredItems.map(renderRow)}
          {logs.length === PAGE_SIZE && (
            <p className="text-[11px] text-muted-foreground pt-2 px-1">Showing the most recent {PAGE_SIZE} messages.</p>
          )}
        </div>

        {/* DETAIL */}
        <div className={cn("md:overflow-hidden", !selected && "hidden md:block")}>
          {renderDetail()}
        </div>
      </div>

      <UserProfileDialog
        open={!!profileLookup}
        onOpenChange={(o) => { if (!o) setProfileLookup(null); }}
        lookup={profileLookup}
        onChanged={(updated) => {
          // Reflect new is_vibe_resident/verification flags into the in-memory user maps
          setUsersByTgId((prev) => {
            const next = new Map(prev);
            if (updated.telegram_user_id) {
              const cur = next.get(Number(updated.telegram_user_id));
              if (cur) next.set(Number(updated.telegram_user_id), { ...cur, is_vibe_resident: updated.is_vibe_resident, world_id_verified: updated.world_id_verified, phone_verified: updated.phone_verified });
            }
            return next;
          });
          setUsersByTgUsername((prev) => {
            const next = new Map(prev);
            if (updated.telegram_username) {
              const key = updated.telegram_username.toLowerCase();
              const cur = next.get(key);
              if (cur) next.set(key, { ...cur, is_vibe_resident: updated.is_vibe_resident, world_id_verified: updated.world_id_verified, phone_verified: updated.phone_verified });
            }
            return next;
          });
        }}
      />
    </div>
  );
}
