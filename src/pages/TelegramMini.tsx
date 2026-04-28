import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { toast } from "sonner";
import vibeyAvatar from "@/assets/vibey-avatar.png";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-vibey`;

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: { user?: { first_name?: string } };
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

export default function TelegramMini() {
  const { agent } = useVibeyAgent();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [tgName, setTgName] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

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

    const initData = tg.initData;
    if (!initData) {
      setAuthState("error");
      setAuthError("No Telegram initData — try reopening the mini app.");
      return;
    }

    (async () => {
      try {
        // Already signed in? Skip.
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

  // 2. Intro message when agent loads
  useEffect(() => {
    if (agent && messages.length === 0 && agent.intro_message) {
      setMessages([{ id: "intro", role: "assistant", content: agent.intro_message }]);
    }
  }, [agent, messages.length]);

  // 3. Sticky-bottom scroll
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 4. Send/stream
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    setMessages((p) => [...p, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);
    stickRef.current = true;

    const payloadMessages = [...messages, userMsg]
      .slice(-20)
      .map(({ role, content }) => ({ role, content }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!resp.ok || !resp.body) {
        toast.error("Vibey couldn't reply");
        setMessages((p) => p.filter((m) => m.id !== assistantId));
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingEvent: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line === "") { pendingEvent = null; continue; }
          if (line.startsWith(":")) continue;
          if (line.startsWith("event: ")) { pendingEvent = line.slice(7).trim(); continue; }
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (pendingEvent === "images") continue;
          if (payload === "[DONE]") return;
          try {
            const parsed = JSON.parse(payload);
            const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((p) =>
                p.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
              );
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      toast.error("Connection error", {
        description: e instanceof Error ? e.message : "Unknown",
      });
      setMessages((p) => p.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  };

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
            {agent?.name ?? "Vibey"}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {tgName ? `hi, ${tgName}` : "telegram mini app"}
          </p>
        </div>
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto px-4 py-3 space-y-3"
      >
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}
            >
              {msg.content || (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> thinking…
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="message vibey…"
            disabled={isStreaming}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
