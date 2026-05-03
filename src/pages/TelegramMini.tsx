import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Brain, Tag, Share2 } from "lucide-react";
import { formatMemoryForTelegram, buildTelegramShareUrl } from "@/lib/shareMemory";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import vibeyAvatar from "@/assets/vibey-avatar.png";

const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

type MemoryRow = {
  id: string;
  content: string | null;
  tags: string[] | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
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

export default function TelegramMini() {
  const { agent } = useVibeyAgent();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [tgName, setTgName] = useState<string | null>(null);
  const [tgUserId, setTgUserId] = useState<number | null>(null);

  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [memLoading, setMemLoading] = useState(true);

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
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
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
              <section className="space-y-2">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  your preferences{mine.length ? ` · ${mine.length}` : ""}
                </h2>
                {mine.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">
                    nothing saved about you yet. dm vibey something like
                    "remember i'm vegetarian."
                  </p>
                ) : (
                  <AnimatePresence initial={false}>
                    {mine.map((m) => (
                      <MemoryCard key={m.id} m={m} highlight />
                    ))}
                  </AnimatePresence>
                )}
              </section>

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
      </div>
    </div>
  );
}
