import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Brain,
  Tag,
  Share2,
  Heart,
  Sparkles,
  Filter,
  Check,
  Pencil,
  Shield,
  Trash2,
  MessageSquare,
  X,
} from "lucide-react";
import { formatMemoryForTelegram, buildTelegramShareUrl } from "@/lib/shareMemory";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { VIBEY_COMMUNITY_ID } from "@/lib/vibey";
import { toast } from "sonner";
import vibeyAvatar from "@/assets/vibey-avatar.png";

const PREFERENCE_COMMUNITIES: { community_id: string; agent_id: string; label: string }[] = [
  {
    community_id: VIBEY_COMMUNITY_ID,
    agent_id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    label: "with vibey",
  },
];

const PREFERENCE_COMMUNITY_IDS = PREFERENCE_COMMUNITIES.map((c) => c.community_id);

const PREFERENCE_SUGGESTIONS = [
  "please call me sir",
  "use all lowercase and be extra vibey",
  "keep replies under 3 sentences",
  "no emojis, ever",
  "be brutally honest with me",
  "match my energy — playful and curious",
];

type MemoryRow = {
  id: string;
  title: string | null;
  content: string | null;
  tags: string[] | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type PreferenceRow = {
  id: string;
  community_id: string;
  telegram_user_id?: number | null;
  relationship_notes: string | null;
  display_name: string | null;
  updated_at: string | null;
};

type ChatLogRow = {
  id: string;
  user_message: string;
  agent_response: string;
  telegram_username: string | null;
  telegram_user_id: number | null;
  created_at: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: { user?: { id?: number; first_name?: string } };
        ready: () => void;
        expand: () => void;
        colorScheme?: "light" | "dark";
        themeParams?: Record<string, string>;
        MainButton?: { hide: () => void };
      };
    };
  }
}

type AuthState = "loading" | "ready" | "error";

function memorySource(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const username = metadata.telegram_username as string | undefined;
  const source = metadata.source as string | undefined;
  if (username) return `@${username}`;
  if (source === "telegram_group") return "telegram group";
  if (source === "telegram_dm") return "telegram dm";
  if (source === "telegram_agent") return "telegram";
  if (source === "web") return "web chat";
  if (source === "admin_panel") return "admin";
  return null;
}

const URL_REGEX = /(https?:\/\/[^\s)]+)/g;

function renderWithLinks(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function MemoryCard({
  m,
  highlight,
  adminMode,
  onEdit,
  onDelete,
}: {
  m: MemoryRow;
  highlight?: boolean;
  adminMode?: boolean;
  onEdit?: (m: MemoryRow) => void;
  onDelete?: (m: MemoryRow) => void;
}) {
  const source = memorySource(m.metadata);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={
        "p-3 rounded-lg bg-card border overflow-hidden " +
        (highlight ? "border-primary/40" : "border-border")
      }
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          {m.title && (
            <p className="text-sm font-semibold mb-1 break-words [overflow-wrap:anywhere]">
              {m.title}
            </p>
          )}
          <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere] text-muted-foreground">
            {m.content ? renderWithLinks(m.content) : null}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {adminMode && onEdit && (
            <button
              onClick={() => onEdit(m)}
              className="text-muted-foreground hover:text-primary p-1"
              aria-label="Edit memory"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {adminMode && onDelete && (
            <button
              onClick={() => onDelete(m)}
              className="text-muted-foreground hover:text-destructive p-1"
              aria-label="Delete memory"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <a
            href={buildTelegramShareUrl(formatMemoryForTelegram(m))}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary p-1"
            aria-label="Share to Telegram"
          >
            <Share2 className="w-3.5 h-3.5" />
          </a>
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
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PreferenceEditor({
  community_id,
  agent_id,
  label,
  existing,
  saving,
  saved,
  onSave,
}: {
  community_id: string;
  agent_id: string;
  label: string;
  existing: PreferenceRow | null;
  saving: boolean;
  saved: boolean;
  onSave: (notes: string) => void;
}) {
  const initial = existing?.relationship_notes ?? "";
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(!initial);

  useEffect(() => {
    setValue(existing?.relationship_notes ?? "");
  }, [existing?.id, existing?.relationship_notes]);

  const dirty = value.trim() !== (existing?.relationship_notes ?? "").trim();
  const isEmpty = !(existing?.relationship_notes ?? "").trim();

  return (
    <div className="p-3 rounded-lg bg-card border border-primary/30 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {!editing && !isEmpty && (
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" /> edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. call me sir, keep it short, no emojis"
            rows={3}
            className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60 resize-y font-sans"
          />

          {!value.trim() && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                try one
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setValue(s)}
                    className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-muted-foreground font-mono">
              {existing?.updated_at
                ? `updated ${formatDistanceToNow(new Date(existing.updated_at), { addSuffix: true })}`
                : "not set yet"}
            </p>
            <div className="flex items-center gap-2">
              {!isEmpty && (
                <button
                  onClick={() => {
                    setValue(existing?.relationship_notes ?? "");
                    setEditing(false);
                  }}
                  className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  cancel
                </button>
              )}
              <button
                onClick={() => {
                  onSave(value);
                  setEditing(false);
                }}
                disabled={saving || !dirty}
                className="text-[11px] font-mono uppercase tracking-widest px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : saved ? (
                  <Check className="w-3 h-3" />
                ) : null}
                save
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm whitespace-pre-wrap">
          {existing?.relationship_notes}
        </p>
      )}
    </div>
  );
}

// ===== Admin: Soul (system_prompt) editor =====
function SoulEditor({
  agentId,
  initial,
}: {
  agentId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(initial), [initial]);
  const dirty = value !== initial;

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agents")
        .update({ system_prompt: value, updated_at: new Date().toISOString() })
        .eq("id", agentId);
      if (error) throw error;
      toast.success("Soul saved");
    } catch (e) {
      toast.error("Couldn't save soul", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-3 rounded-lg bg-card border border-primary/30 space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={12}
        className="w-full bg-background border border-border rounded-md p-2 text-xs font-mono focus:outline-none focus:border-primary/60 resize-y leading-relaxed"
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="text-[11px] font-mono uppercase tracking-widest px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          save soul
        </button>
      </div>
    </div>
  );
}

// ===== Admin: edit modal for memory =====
function MemoryEditModal({
  memory,
  onClose,
  onSaved,
}: {
  memory: MemoryRow;
  onClose: () => void;
  onSaved: (m: MemoryRow) => void;
}) {
  const [content, setContent] = useState(memory.content ?? "");
  const [tags, setTags] = useState((memory.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const tagArr = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const { data, error } = await supabase
        .from("memories")
        .update({ content, tags: tagArr })
        .eq("id", memory.id)
        .select("id, content, tags, created_at, metadata")
        .single();
      if (error) throw error;
      toast.success("Memory saved");
      onSaved(data as MemoryRow);
      onClose();
    } catch (e) {
      toast.error("Couldn't save memory", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
            edit memory
          </p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60 resize-y"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="comma, separated, tags"
          className="w-full bg-background border border-border rounded-md p-2 text-xs font-mono focus:outline-none focus:border-primary/60"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground px-3 py-1"
          >
            cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-[11px] font-mono uppercase tracking-widest px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 flex items-center gap-1"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TelegramMini() {
  const { agent } = useVibeyAgent();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [tgName, setTgName] = useState<string | null>(null);
  const [tgUserId, setTgUserId] = useState<number | null>(null);

  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [memLoading, setMemLoading] = useState(true);
  const [prefs, setPrefs] = useState<PreferenceRow[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [memFilter, setMemFilter] = useState<"all" | "mine" | "others">("all");

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryRow | null>(null);
  const [allPrefs, setAllPrefs] = useState<PreferenceRow[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLogRow[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // 1. Telegram WebApp + auth (with preview/mock fallback)
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const params = new URLSearchParams(window.location.search);
    const isPreviewHost =
      window.location.hostname.includes("lovable.app") &&
      window.location.hostname.includes("preview");
    const mockMode =
      params.get("mock") === "1" ||
      (!tg && (isPreviewHost || window.location.hostname === "localhost"));

    if (!tg && !mockMode) {
      setAuthState("error");
      setAuthError("Open this page from inside Telegram (or add ?mock=1 to preview).");
      return;
    }

    if (tg) {
      tg.ready();
      tg.expand();
      setTgName(tg.initDataUnsafe?.user?.first_name ?? null);
      setTgUserId(tg.initDataUnsafe?.user?.id ?? null);
    }

    const initData = tg?.initData;

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();

        if (mockMode) {
          // Preview mode: rely on an existing Supabase session (admin login).
          if (!sessionData.session) {
            throw new Error(
              "Preview mode needs a Supabase session. Sign in at /login first, then return here.",
            );
          }
          const u = sessionData.session.user;
          setTgName(
            (u.user_metadata?.name as string) ??
              u.email?.split("@")[0] ??
              "Preview",
          );
          // Stable fake telegram_user_id derived from auth uid so "mine" filter works.
          let hash = 0;
          for (const ch of u.id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
          setTgUserId(Math.abs(hash) || 1);
        } else if (!sessionData.session) {
          if (!initData) throw new Error("No Telegram initData — try reopening the mini app.");
          const { data, error } = await supabase.functions.invoke(
            "telegram-mini-auth",
            { body: { initData } },
          );
          if (error) throw error;
          if (!data?.token_hash || !data?.email) throw new Error("no token");
          const { error: verifyErr } = await supabase.auth.verifyOtp({
            token_hash: data.token_hash,
            type: "magiclink",
          });
          if (verifyErr) throw verifyErr;
          if (data.user?.name) setTgName(data.user.name);
        }

        // Check admin status (server-side via SECURITY DEFINER function)
        const { data: adminCheck, error: adminErr } = await supabase.rpc(
          "is_community_admin",
          {
            community_id_param: VIBEY_COMMUNITY_ID,
            user_auth_id: (await supabase.auth.getUser()).data.user?.id,
          },
        );
        if (!adminErr && adminCheck === true) setIsAdmin(true);

        setAuthState("ready");
      } catch (e) {
        console.error(e);
        setAuthError(e instanceof Error ? e.message : "Auth failed");
        setAuthState("error");
      }
    })();
  }, []);

  // 2. Memories + realtime
  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("id, title, content, tags, created_at, metadata")
        .eq("community_id", VIBEY_COMMUNITY_ID)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) console.error("load memories failed", error.message);
      else setMemories((data ?? []) as MemoryRow[]);
      setMemLoading(false);
    })();

    const channel = supabase
      .channel("mini-memories")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "memories",
          filter: `community_id=eq.${VIBEY_COMMUNITY_ID}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as MemoryRow;
            setMemories((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as MemoryRow;
            setMemories((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as MemoryRow;
            setMemories((prev) => prev.filter((m) => m.id !== row.id));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [authState]);

  // 3. Personal preferences
  useEffect(() => {
    if (authState !== "ready" || !tgUserId) {
      setPrefsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vibey_relationships")
        .select("id, community_id, telegram_user_id, relationship_notes, display_name, updated_at")
        .in("community_id", PREFERENCE_COMMUNITY_IDS)
        .eq("telegram_user_id", tgUserId);
      if (cancelled) return;
      if (error) console.error("load prefs failed", error.message);
      else setPrefs((data ?? []) as PreferenceRow[]);
      setPrefsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authState, tgUserId]);

  // 4. Admin data — load all prefs + chat logs when admin mode is on
  useEffect(() => {
    if (!adminMode || !isAdmin) return;
    let cancelled = false;
    setAdminLoading(true);
    (async () => {
      const [prefsRes, logsRes] = await Promise.all([
        supabase
          .from("vibey_relationships")
          .select("id, community_id, telegram_user_id, relationship_notes, display_name, updated_at")
          .eq("community_id", VIBEY_COMMUNITY_ID)
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase
          .from("agent_chat_logs")
          .select("id, user_message, agent_response, telegram_username, telegram_user_id, created_at")
          .eq("community_id", VIBEY_COMMUNITY_ID)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;
      if (prefsRes.error) console.error("load all prefs", prefsRes.error.message);
      else setAllPrefs((prefsRes.data ?? []) as PreferenceRow[]);
      if (logsRes.error) console.error("load chat logs", logsRes.error.message);
      else setChatLogs((logsRes.data ?? []) as ChatLogRow[]);
      setAdminLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminMode, isAdmin]);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function savePreference(community_id: string, agent_id: string, notes: string) {
    if (!tgUserId) return;
    setSavingId(community_id);
    const existing = prefs.find((p) => p.community_id === community_id);
    const trimmed = notes.trim();
    try {
      if (existing) {
        const { data, error } = await supabase
          .from("vibey_relationships")
          .update({
            relationship_notes: trimmed.length ? trimmed : null,
            display_name: tgName ?? existing.display_name,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id, community_id, telegram_user_id, relationship_notes, display_name, updated_at")
          .single();
        if (error) throw error;
        setPrefs((prev) => prev.map((p) => (p.id === existing.id ? (data as PreferenceRow) : p)));
      } else {
        const { data, error } = await supabase
          .from("vibey_relationships")
          .insert({
            community_id,
            agent_id,
            telegram_user_id: tgUserId,
            display_name: tgName,
            relationship_notes: trimmed.length ? trimmed : null,
          })
          .select("id, community_id, telegram_user_id, relationship_notes, display_name, updated_at")
          .single();
        if (error) throw error;
        setPrefs((prev) => [...prev, data as PreferenceRow]);
      }
      setSavedId(community_id);
      setTimeout(() => setSavedId((v) => (v === community_id ? null : v)), 1500);
      toast.success("Preferences saved");
    } catch (e) {
      console.error("save preference failed", e);
      toast.error("Couldn't save preferences", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSavingId(null);
    }
  }

  async function deleteMemory(m: MemoryRow) {
    if (!confirm("delete this memory? this can't be undone.")) return;
    const { error } = await supabase.from("memories").delete().eq("id", m.id);
    if (error) {
      toast.error("Couldn't delete memory", { description: error.message });
      return;
    }
    toast.success("Memory deleted");
    setMemories((prev) => prev.filter((x) => x.id !== m.id));
  }

  const isMine = (m: MemoryRow) =>
    tgUserId != null &&
    Number((m.metadata as Record<string, unknown> | null)?.telegram_user_id) === tgUserId;

  const filteredMemories = useMemo(() => {
    if (memFilter === "mine") return memories.filter(isMine);
    if (memFilter === "others") return memories.filter((m) => !isMine(m));
    return memories;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories, memFilter, tgUserId]);

  // ===== Render =====
  if (authState === "loading") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          connecting to vibey
        </p>
      </div>
    );
  }

  if (authState === "error") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground p-6 text-center">
        <p className="text-sm">{authError ?? "Couldn't sign you in."}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          telegram mini app · vibey
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-primary/30">
          <img src={vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            {agent?.name ?? "Vibey"}'s Brain
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {memLoading ? "loading…" : `${memories.length} memories${tgName ? ` · hi, ${tgName}` : ""}`}
          </p>
        </div>
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      </div>

      {/* Admin toggle */}
      {isAdmin && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-card/40">
          <div className="flex items-center gap-1.5 text-primary">
            <Shield className="w-3 h-3" />
            <span className="font-mono text-[10px] uppercase tracking-widest">admin</span>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded p-0.5">
            <button
              onClick={() => setAdminMode(false)}
              className={
                "px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-widest transition-colors " +
                (!adminMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")
              }
            >
              standard view
            </button>
            <button
              onClick={() => setAdminMode(true)}
              className={
                "px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-widest transition-colors " +
                (adminMode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")
              }
            >
              admin view
            </button>
          </div>
        </div>
      )}

      {/* Stream */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-5">
        {!adminMode && (
          <>
            {/* Personal preferences */}
            <section className="space-y-3">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Heart className="w-3 h-3" />
                your preferences
              </h2>
              <p className="text-[11px] text-muted-foreground px-0.5 leading-relaxed">
                tell vibey how you want to be talked to. this shapes every reply you'll get — tone,
                length, nicknames, vibe.
              </p>
              {prefsLoading || !tgUserId ? (
                <div className="flex items-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                PREFERENCE_COMMUNITIES.map((c) => (
                  <PreferenceEditor
                    key={c.community_id}
                    community_id={c.community_id}
                    agent_id={c.agent_id}
                    label={c.label}
                    existing={prefs.find((p) => p.community_id === c.community_id) ?? null}
                    saving={savingId === c.community_id}
                    saved={savedId === c.community_id}
                    onSave={(notes) => savePreference(c.community_id, c.agent_id, notes)}
                  />
                ))
              )}
            </section>

            {/* Memories */}
            {memLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : memories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Brain className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">no memories yet</p>
              </div>
            ) : (
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Brain className="w-3 h-3" />
                    community memory · {memories.length}
                  </h2>
                  <div className="flex items-center gap-1">
                    <Filter className="w-3 h-3 text-muted-foreground" />
                    {(["all", "mine", "others"] as const).map((key) => {
                      const count =
                        key === "mine"
                          ? memories.filter(isMine).length
                          : key === "others"
                            ? memories.filter((m) => !isMine(m)).length
                            : memories.length;
                      if (key === "mine" && tgUserId == null) return null;
                      return (
                        <button
                          key={key}
                          onClick={() => setMemFilter(key)}
                          className={
                            "px-2 py-1 rounded font-mono text-[10px] uppercase tracking-widest transition-colors " +
                            (memFilter === key
                              ? "bg-primary/15 text-primary border border-primary/40"
                              : "bg-muted text-muted-foreground border border-transparent hover:text-foreground")
                          }
                        >
                          {key} · {count}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {filteredMemories.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">
                    nothing here yet for this filter.
                  </p>
                ) : (
                  <AnimatePresence initial={false}>
                    {filteredMemories.map((m) => (
                      <MemoryCard key={m.id} m={m} highlight={isMine(m)} />
                    ))}
                  </AnimatePresence>
                )}
              </section>
            )}

            {/* Soul (read-only) */}
            {agent?.system_prompt && (
              <section className="space-y-2 pt-2">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  vibey's soul · system prompt
                </h2>
                <div className="p-3 rounded-lg bg-card border border-border">
                  <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-foreground/90">
                    {agent.system_prompt}
                  </pre>
                  <p className="text-[10px] text-muted-foreground font-mono mt-3">
                    read-only · this is the bones of who vibey is
                  </p>
                </div>
              </section>
            )}
          </>
        )}

        {adminMode && isAdmin && (
          <>
            {/* Soul editor */}
            {agent?.id && agent?.system_prompt != null && (
              <section className="space-y-2">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  edit soul · system prompt
                </h2>
                <SoulEditor agentId={agent.id} initial={agent.system_prompt} />
              </section>
            )}

            {/* All memories with edit/delete */}
            <section className="space-y-2">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Brain className="w-3 h-3" />
                edit memories · {memories.length}
              </h2>
              {memLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <AnimatePresence initial={false}>
                  {memories.map((m) => (
                    <MemoryCard
                      key={m.id}
                      m={m}
                      adminMode
                      onEdit={setEditingMemory}
                      onDelete={deleteMemory}
                    />
                  ))}
                </AnimatePresence>
              )}
            </section>

            {/* All preferences */}
            <section className="space-y-2">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Heart className="w-3 h-3" />
                everyone's preferences · {allPrefs.length}
              </h2>
              {adminLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : allPrefs.length === 0 ? (
                <p className="text-xs text-muted-foreground">no preferences set yet.</p>
              ) : (
                allPrefs.map((p) => (
                  <div key={p.id} className="p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold">
                        {p.display_name ?? `tg ${p.telegram_user_id ?? "?"}`}
                      </p>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {p.updated_at
                          ? formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })
                          : ""}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-foreground/90">
                      {p.relationship_notes ?? <span className="text-muted-foreground italic">— empty —</span>}
                    </p>
                  </div>
                ))
              )}
            </section>

            {/* Chat history */}
            <section className="space-y-2">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" />
                recent conversations · {chatLogs.length}
              </h2>
              {adminLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : chatLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground">no chat logs yet.</p>
              ) : (
                chatLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {log.telegram_username ? `@${log.telegram_username}` : `tg ${log.telegram_user_id ?? "?"}`}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-xs">
                      <p className="text-muted-foreground font-mono text-[10px] uppercase mb-0.5">user</p>
                      <p className="whitespace-pre-wrap">{log.user_message}</p>
                    </div>
                    <div className="text-xs">
                      <p className="text-primary font-mono text-[10px] uppercase mb-0.5">vibey</p>
                      <p className="whitespace-pre-wrap">{log.agent_response}</p>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>

      {editingMemory && (
        <MemoryEditModal
          memory={editingMemory}
          onClose={() => setEditingMemory(null)}
          onSaved={(m) => setMemories((prev) => prev.map((x) => (x.id === m.id ? m : x)))}
        />
      )}
    </div>
  );
}
