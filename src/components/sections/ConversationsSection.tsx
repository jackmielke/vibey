import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, MessagesSquare, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { toast } from "sonner";

type UserLite = {
  id: string;
  name: string | null;
  telegram_username: string | null;
  telegram_user_id: number | null;
  telegram_photo_url: string | null;
  avatar_url: string | null;
};

function initialsOf(label: string) {
  return label
    .replace(/^@/, "")
    .split(/[\s_·]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type ChatLog = {
  id: string;
  user_message: string;
  agent_response: string;
  created_at: string;
  session_key: string | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
};

type GroupSetting = {
  chat_id: number;
  chat_title: string | null;
};

type Conversation = {
  key: string; // unique grouping key
  label: string;
  isGroup: boolean;
  isTelegram: boolean;
  chatId: number | null;
  sessionKey: string | null;
  telegramUsername: string | null;
  telegramUserId: number | null;
  messageCount: number;
  lastMessageAt: string;
  lastPreview: string;
};

const PAGE_SIZE = 500;

function buildLabel(
  log: ChatLog,
  groupTitleByChatId: Map<number, string>
): { label: string; isGroup: boolean } {
  const chatId = log.telegram_chat_id;

  if (chatId !== null) {
    // Telegram
    if (chatId < 0) {
      // group / supergroup (Telegram negative IDs)
      const title = groupTitleByChatId.get(chatId);
      return { label: title ?? `Group ${chatId}`, isGroup: true };
    }
    return { label: log.telegram_username ?? `DM ${chatId}`, isGroup: false };
  }

  // Web / other surfaces: derive from session_key like "web:anon" or "web:abc"
  if (log.session_key) {
    const [surface, id] = log.session_key.split(":");
    return { label: `${surface ?? "web"} · ${id ?? "anon"}`, isGroup: false };
  }
  return { label: "unknown", isGroup: false };
}

function conversationKey(log: ChatLog): string {
  if (log.telegram_chat_id !== null) return `tg:${log.telegram_chat_id}`;
  return `sk:${log.session_key ?? "unknown"}`;
}

export function ConversationsSection() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [groupTitles, setGroupTitles] = useState<Map<number, string>>(new Map());
  const [usersByTgUsername, setUsersByTgUsername] = useState<Map<string, UserLite>>(new Map());
  const [usersByTgId, setUsersByTgId] = useState<Map<number, UserLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: logsData, error: logsErr }, { data: groupsData }, { data: usersData }] =
        await Promise.all([
          supabase
            .from("agent_chat_logs")
            .select(
              "id, user_message, agent_response, created_at, session_key, telegram_chat_id, telegram_username"
            )
            .order("created_at", { ascending: false })
            .limit(PAGE_SIZE),
          supabase.from("telegram_group_settings").select("chat_id, chat_title"),
          supabase
            .from("users")
            .select("id, name, telegram_username, telegram_user_id, telegram_photo_url, avatar_url")
            .or("telegram_username.not.is.null,telegram_user_id.not.is.null"),
        ]);

      if (cancelled) return;

      if (logsErr) {
        toast.error("Couldn't load conversations", { description: logsErr.message });
        setLoading(false);
        return;
      }

      const titleMap = new Map<number, string>();
      for (const g of (groupsData ?? []) as GroupSetting[]) {
        if (g.chat_title) titleMap.set(g.chat_id, g.chat_title);
      }

      const byUsername = new Map<string, UserLite>();
      const byId = new Map<number, UserLite>();
      for (const u of (usersData ?? []) as UserLite[]) {
        if (u.telegram_username) byUsername.set(u.telegram_username.toLowerCase(), u);
        if (u.telegram_user_id) byId.set(Number(u.telegram_user_id), u);
      }

      setGroupTitles(titleMap);
      setUsersByTgUsername(byUsername);
      setUsersByTgId(byId);
      setLogs((logsData ?? []) as ChatLog[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group logs into conversations
  const conversations = useMemo<Conversation[]>(() => {
    const map = new Map<string, Conversation>();
    for (const log of logs) {
      const key = conversationKey(log);
      const existing = map.get(key);
      if (existing) {
        existing.messageCount += 1;
        // logs come newest first, so keep the first one we see as the latest
        continue;
      }
      const { label, isGroup } = buildLabel(log, groupTitles);
      map.set(key, {
        key,
        label,
        isGroup,
        isTelegram: log.telegram_chat_id !== null,
        chatId: log.telegram_chat_id,
        sessionKey: log.session_key,
        telegramUsername: log.telegram_username,
        telegramUserId:
          log.telegram_chat_id !== null && log.telegram_chat_id > 0 ? log.telegram_chat_id : null,
        messageCount: 1,
        lastMessageAt: log.created_at,
        lastPreview: log.user_message,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      b.lastMessageAt.localeCompare(a.lastMessageAt)
    );
  }, [logs, groupTitles]);

  function lookupUser(c: Conversation): UserLite | null {
    if (c.telegramUserId && usersByTgId.has(c.telegramUserId)) {
      return usersByTgId.get(c.telegramUserId)!;
    }
    if (c.telegramUsername) {
      return usersByTgUsername.get(c.telegramUsername.toLowerCase()) ?? null;
    }
    return null;
  }

  function avatarFor(c: Conversation): { url?: string; initials: string } {
    const u = lookupUser(c);
    const url = u?.telegram_photo_url || u?.avatar_url || undefined;
    const initials = initialsOf(u?.name || c.label || "?");
    return { url, initials };
  }

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.key === selectedKey) ?? null,
    [conversations, selectedKey]
  );

  const selectedMessages = useMemo(() => {
    if (!selectedKey) return [];
    return logs
      .filter((l) => conversationKey(l) === selectedKey)
      .slice()
      .reverse(); // chronological inside the thread
  }, [logs, selectedKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
          <MessagesSquare className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No conversations yet</p>
      </div>
    );
  }

  // Detail view
  if (selectedConversation) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 -ml-2"
          onClick={() => setSelectedKey(null)}
        >
          <ArrowLeft className="w-4 h-4" />
          All conversations
        </Button>

        <div className="flex items-center gap-3">
          {(() => {
            const { url, initials } = avatarFor(selectedConversation);
            return (
              <div className="relative shrink-0">
                {selectedConversation.isGroup ? (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                ) : (
                  <Avatar className="h-10 w-10 rounded-lg ring-1 ring-border">
                    {url && <AvatarImage src={url} alt={selectedConversation.label} />}
                    <AvatarFallback className="rounded-lg text-[11px] font-mono">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })()}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{selectedConversation.label}</p>
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
              {selectedConversation.isTelegram && (
                <TelegramIcon className="w-3 h-3 text-[#229ED9]" />
              )}
              <span>
                {selectedConversation.chatId ?? selectedConversation.sessionKey} ·{" "}
                {selectedConversation.messageCount} messages
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {selectedMessages.map((m) => (
            <div key={m.id} className="space-y-2">
              <div className="flex flex-col items-end">
                <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-primary/10 border border-primary/20">
                  {m.user_message}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 font-mono">
                  {m.telegram_username ?? "user"} ·{" "}
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                </span>
              </div>
              <div className="flex flex-col items-start">
                <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-card border border-border">
                  {m.agent_response}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 font-mono">vibey</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-2 max-w-2xl">
      {conversations.map((c) => {
        const { url, initials } = avatarFor(c);
        return (
          <button
            key={c.key}
            onClick={() => setSelectedKey(c.key)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors text-left"
          >
            <div className="relative shrink-0">
              {c.isGroup ? (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
              ) : (
                <Avatar className="h-10 w-10 rounded-lg ring-1 ring-border">
                  {url && <AvatarImage src={url} alt={c.label} />}
                  <AvatarFallback className="rounded-lg text-[11px] font-mono">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{c.label}</p>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastPreview}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                {c.isTelegram && <TelegramIcon className="w-2.5 h-2.5 text-[#229ED9]" />}
                <span>
                  {c.isTelegram ? "Telegram · " : ""}
                  {c.messageCount} message{c.messageCount === 1 ? "" : "s"}
                </span>
              </p>
            </div>
          </button>
        );
      })}
      {logs.length === PAGE_SIZE && (
        <p className="text-xs text-muted-foreground pt-2">
          Showing the most recent {PAGE_SIZE} messages.
        </p>
      )}
    </div>
  );
}
