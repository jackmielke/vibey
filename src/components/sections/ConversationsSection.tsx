import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Coins, Loader2, MessagesSquare, UsersRound, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { formatCredits, formatTokens } from "@/lib/usage";
import { toast } from "sonner";

type Mode = "read_only" | "reply";

type UserLite = {
  id: string;
  name: string | null;
  telegram_username: string | null;
  telegram_user_id: number | null;
  telegram_photo_url: string | null;
  avatar_url: string | null;
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

const PAGE_SIZE = 500;

function initialsOf(label: string) {
  return label.replace(/^@/, "").split(/[\s_·]+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function ConversationsSection() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as "groups" | "dms") || "groups";
  const setTab = (next: string) => {
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
            .select("id, name, telegram_username, telegram_user_id, telegram_photo_url, avatar_url")
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

  // ── Group permission persist ──
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

  // ── DM permission persist (upsert) ──
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

  // ── Derive DM conversations from logs + settings ──
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
    // Also include DMs that have an explicit setting but no logs yet
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

  // ── Thread messages for selected ──
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

  // ── Thread detail view ──
  if (selected) {
    const headerLabel = selected.kind === "group"
      ? groups.find((g) => g.chat_id === selected.chatId)?.chat_title ?? `Group ${selected.chatId}`
      : dmConversations.find((d) => d.telegramUserId === selected.telegramUserId)?.label ?? `User ${selected.telegramUserId}`;

    return (
      <div className="space-y-4 max-w-3xl w-full min-w-0 overflow-hidden">
        <div className="sticky -top-5 -mx-5 px-5 pt-5 pb-3 z-10 bg-background/95 backdrop-blur-sm border-b border-border space-y-3">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => setSelected(null)}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            {selected.kind === "group" ? (
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <UsersRound className="w-4 h-4 text-muted-foreground" />
              </div>
            ) : (() => {
              const dm = dmConversations.find((d) => d.telegramUserId === selected.telegramUserId);
              const url = dm?.user?.telegram_photo_url || dm?.user?.avatar_url || undefined;
              return (
                <Avatar className="h-10 w-10 rounded-lg ring-1 ring-border">
                  {url && <AvatarImage src={url} alt={headerLabel} />}
                  <AvatarFallback className="rounded-lg text-[11px] font-mono">{initialsOf(headerLabel)}</AvatarFallback>
                </Avatar>
              );
            })()}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{headerLabel}</p>
              <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 min-w-0">
                <TelegramIcon className="w-3 h-3 text-[#229ED9] shrink-0" />
                <span className="truncate">
                  {selected.kind === "group" ? selected.chatId : selected.telegramUserId} · {threadMessages.length} messages
                </span>
              </p>
            </div>
          </div>
        </div>


        {threadMessages.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No messages yet.</p>
        )}

        <div className="space-y-3">
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
  }

  // ── List view with tabs ──
  return (
    <div className="space-y-4 max-w-2xl w-full min-w-0">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="groups">
            Groups <span className="ml-1.5 text-muted-foreground">({groups.length})</span>
          </TabsTrigger>
          <TabsTrigger value="dms">
            DMs <span className="ml-1.5 text-muted-foreground">({dmConversations.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* GROUPS */}
        <TabsContent value="groups" className="space-y-3 mt-4">
          {groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <UsersRound className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No group chats yet</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Add <span className="font-mono">@vibey_ai_bot</span> to a Telegram group, send any message, and it'll appear here.
              </p>
            </div>
          )}
          {groups.map((g) => {
            const updating = updatingKey === `g:${g.chat_id}`;
            return (
              <div key={g.chat_id} className="p-4 rounded-lg bg-card border border-border space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "group", chatId: g.chat_id })}
                    className="min-w-0 text-left flex-1 hover:opacity-80 transition-opacity"
                  >
                    <p className="text-sm font-medium truncate">{g.chat_title ?? `Chat ${g.chat_id}`}</p>
                    <p className="text-xs text-muted-foreground font-mono">{g.chat_id}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added {formatDistanceToNow(new Date(g.added_at), { addSuffix: true })}
                      {g.enabled && g.enabled_at && (
                        <> · enabled {formatDistanceToNow(new Date(g.enabled_at), { addSuffix: true })}</>
                      )}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {updating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {g.enabled ? "on" : "off"}
                      </span>
                      <Switch
                        checked={g.enabled}
                        onCheckedChange={(checked) =>
                          persistGroup(g.chat_id, checked
                            ? { enabled: true, enabled_at: new Date().toISOString() }
                            : { enabled: false })
                        }
                        disabled={updating}
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
                          ? "Replies when @mentioned or replied to."
                          : "Listens silently — no replies, ever."}
                      </p>
                    </div>
                    <Switch
                      checked={g.mode === "reply"}
                      onCheckedChange={(checked) => persistGroup(g.chat_id, { mode: checked ? "reply" : "read_only" })}
                      disabled={updating}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-2">
            Off = ignored. On + read-only = listens but never replies. On + reply = answers when @mentioned or replied to.
            You can also send <span className="font-mono">/vibey on</span> or <span className="font-mono">/vibey off</span> in the group.
          </p>
        </TabsContent>

        {/* DMs */}
        <TabsContent value="dms" className="space-y-3 mt-4">
          {dmConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <MessagesSquare className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No DMs yet</p>
            </div>
          )}
          {dmConversations.map((c) => {
            const updating = updatingKey === `d:${c.telegramUserId}`;
            // Effective state: explicit setting wins; otherwise inferred "reply" if they've gotten replies, else muted.
            const enabled = c.setting?.enabled ?? true;
            const mode: Mode = c.setting?.mode ?? (c.hasReplies ? "reply" : "read_only");
            const isExplicit = !!c.setting;
            const photoUrl = c.user?.telegram_photo_url || c.user?.avatar_url || undefined;
            return (
              <div key={c.telegramUserId} className="p-4 rounded-lg bg-card border border-border space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "dm", telegramUserId: c.telegramUserId })}
                    className="min-w-0 text-left flex-1 flex items-start gap-3 hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="h-10 w-10 rounded-lg ring-1 ring-border shrink-0">
                      {photoUrl && <AvatarImage src={photoUrl} alt={c.label} />}
                      <AvatarFallback className="rounded-lg text-[11px] font-mono">{initialsOf(c.label)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.label}</p>
                      {c.username && (
                        <p className="text-xs text-muted-foreground font-mono truncate">@{c.username}</p>
                      )}
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastPreview || "—"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                        <TelegramIcon className="w-2.5 h-2.5 text-[#229ED9]" />
                        <span>
                          {c.messageCount} msg{c.messageCount === 1 ? "" : "s"}
                          {c.totalTokens > 0 ? ` · ${formatTokens(c.totalTokens)} tok` : ""}
                          {!isExplicit && <> · <span className="italic">{c.hasReplies ? "auto-replying" : "muted (no shared group)"}</span></>}
                        </span>
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {updating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {enabled ? "on" : "off"}
                      </span>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          persistDm(c.telegramUserId, c.username, c.user?.name ?? null, { enabled: checked })
                        }
                        disabled={updating}
                      />
                    </div>
                  </div>
                </div>
                {enabled && (
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/50">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {mode === "reply" ? "Reply mode" : "Read-only mode"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {mode === "reply" ? "Vibey replies to this person." : "Vibey reads but doesn't reply."}
                      </p>
                    </div>
                    <Switch
                      checked={mode === "reply"}
                      onCheckedChange={(checked) =>
                        persistDm(c.telegramUserId, c.username, c.user?.name ?? null, {
                          mode: checked ? "reply" : "read_only",
                          enabled: true,
                        })
                      }
                      disabled={updating}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-2">
            Default: Vibey replies to people who share an enabled group. Toggle here to override per person.
          </p>
        </TabsContent>
      </Tabs>
      {logs.length === PAGE_SIZE && (
        <p className="text-xs text-muted-foreground pt-2">Showing the most recent {PAGE_SIZE} messages.</p>
      )}
    </div>
  );
}
