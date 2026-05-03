import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Brain, Tag, Share2, Heart, Sparkles } from "lucide-react";
import { formatMemoryForTelegram, buildTelegramShareUrl } from "@/lib/shareMemory";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { VIBE_CODE_RESIDENCY_COMMUNITY_ID, VIBEY_COMMUNITY_ID } from "@/lib/vibey";
import vibeyAvatar from "@/assets/vibey-avatar.png";

const PREFERENCE_COMMUNITY_IDS = [
  VIBE_CODE_RESIDENCY_COMMUNITY_ID,
  VIBEY_COMMUNITY_ID,
];

type MemoryRow = {
  id: string;
  content: string | null;
  tags: string[] | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type PreferenceRow = {
  id: string;
  community_id: string;
  relationship_notes: string | null;
  display_name: string | null;
  updated_at: string | null;
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

function MemoryCard({ m, highlight }: { m: MemoryRow; highlight?: boolean }) {
  const source = memorySource(m.metadata);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={
        "p-3 rounded-lg bg-card border " +
        (highlight ? "border-primary/40" : "border-border")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm whitespace-pre-wrap flex-1">{m.content}</p>
        <a
          href={buildTelegramShareUrl(formatMemoryForTelegram(m))}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary p-1 -m-1 shrink-0"
          aria-label="Share to Telegram"
        >
          <Share2 className="w-3.5 h-3.5" />
        </a>
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

  // 1. Initialize Telegram WebApp + auth
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) {
      setAuthState("error");
      setAuthError("Open this page from inside Telegram.");
      return;
    }
    tg.ready();
    tg.expand();
    setTgName(tg.initDataUnsafe?.user?.first_name ?? null);
    setTgUserId(tg.initDataUnsafe?.user?.id ?? null);

    const initData = tg.initData;
    if (!initData) {
      setAuthState("error");
      setAuthError("No Telegram initData — try reopening the mini app.");
      return;
    }

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          setAuthState("ready");
          return;
        }

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
        setAuthState("ready");
      } catch (e) {
        console.error(e);
        setAuthError(e instanceof Error ? e.message : "Auth failed");
        setAuthState("error");
      }
    })();
  }, []);

  // 2. Load memories + subscribe to realtime inserts/updates/deletes
  useEffect(() => {
    if (authState !== "ready") return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("id, content, tags, created_at, metadata")
        .eq("community_id", VIBEY_COMMUNITY_ID)
        .order("created_at", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (error) {
        console.error("load memories failed", error.message);
      } else {
        setMemories((data ?? []) as MemoryRow[]);
      }
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
            setMemories((prev) =>
              prev.some((m) => m.id === row.id) ? prev : [row, ...prev],
            );
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as MemoryRow;
            setMemories((prev) =>
              prev.map((m) => (m.id === row.id ? row : m)),
            );
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

  // 3. Load preferences (vibey_relationships) for current Telegram user
  useEffect(() => {
    if (authState !== "ready" || !tgUserId) {
      setPrefsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vibey_relationships")
        .select("id, community_id, relationship_notes, display_name, updated_at")
        .in("community_id", PREFERENCE_COMMUNITY_IDS)
        .eq("telegram_user_id", tgUserId)
        .not("relationship_notes", "is", null);
      if (cancelled) return;
      if (error) {
        console.error("load prefs failed", error.message);
      } else {
        setPrefs(
          ((data ?? []) as PreferenceRow[]).filter((p) =>
            (p.relationship_notes ?? "").trim().length > 0,
          ),
        );
      }
      setPrefsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authState, tgUserId]);

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
      {/* Compact header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-primary/30">
          <img
            src={agent?.avatar_url || vibeyAvatar}
            alt="Vibey"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            {agent?.name ?? "Vibey"}'s Brain
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {memLoading
              ? "loading…"
              : `${memories.length} memories${tgName ? ` · hi, ${tgName}` : ""}`}
          </p>
        </div>
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      </div>

      {/* Stream */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-5">
        {/* Preferences (from vibey_relationships) — what Vibey personally knows about you */}
        <section className="space-y-2">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Heart className="w-3 h-3" />
            your preferences{prefs.length ? ` · ${prefs.length}` : ""}
          </h2>
          {prefsLoading ? (
            <div className="flex items-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : prefs.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">
              vibey hasn't noted any preferences for you yet. dm vibey something
              like "remember i prefer lowercase" or "call me sir."
            </p>
          ) : (
            prefs.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-lg bg-card border border-primary/40"
              >
                <p className="text-sm whitespace-pre-wrap">
                  {p.relationship_notes}
                </p>
                {p.updated_at && (
                  <p className="text-[10px] text-muted-foreground font-mono mt-2">
                    updated{" "}
                    {formatDistanceToNow(new Date(p.updated_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
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
            <p className="text-xs text-muted-foreground max-w-xs">
              vibey will save things here as conversations happen.
            </p>
          </div>
        ) : (() => {
          const mine = tgUserId
            ? memories.filter(
                (m) =>
                  Number((m.metadata as Record<string, unknown> | null)?.telegram_user_id) ===
                  tgUserId,
              )
            : [];
          const others = memories.filter((m) => !mine.includes(m));
          return (
            <>
              {mine.length > 0 && (
                <section className="space-y-2">
                  <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Brain className="w-3 h-3" />
                    memories about you · {mine.length}
                  </h2>
                  <AnimatePresence initial={false}>
                    {mine.map((m) => (
                      <MemoryCard key={m.id} m={m} highlight />
                    ))}
                  </AnimatePresence>
                </section>
              )}

              <section className="space-y-2">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  community memory{others.length ? ` · ${others.length}` : ""}
                </h2>
                <AnimatePresence initial={false}>
                  {others.map((m) => (
                    <MemoryCard key={m.id} m={m} />
                  ))}
                </AnimatePresence>
              </section>
            </>
          );
        })()}

        {/* Soul — public, read-only peek at Vibey's system prompt */}
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
      </div>
    </div>
  );
}
