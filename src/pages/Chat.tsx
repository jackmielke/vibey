import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { useAuth } from "@/hooks/useAuth";
import { supabase, supabasePublishableKey, supabaseUrl } from "@/integrations/supabase/client";
import { VoiceMode } from "@/components/VoiceMode";
import { toast } from "sonner";
import vibeyAvatar from "@/assets/vibey-avatar.png";
import { pickBestProfile } from "@/lib/profiles";

interface GalleryImage {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
}

interface ToolEvent {
  id: string;
  name: string;
  status: "start" | "done" | "thought";
  label: string;
  details?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: GalleryImage[];
  tools?: ToolEvent[];
}

const CHAT_URL = `${supabaseUrl}/functions/v1/chat-with-vibey`;

const STARTER_PROMPTS = [
  "what's happening this week?",
  "who should i meet?",
  "remember that i…",
  "what can you do?",
];

function buildIntro(name: string | null): string {
  const hi = name ? `hey ${name.toLowerCase()}` : "hey";
  return `${hi} — i'm vibey, the community's resident ai. i can fill you in on what's happening, point you to people worth meeting, and remember anything you want me to. what's on your mind?`;
}

function firstName(session: ReturnType<typeof useAuth>["session"]): string | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const raw =
    (meta.first_name as string) ||
    (meta.name as string) ||
    (meta.full_name as string) ||
    u.email?.split("@")[0] ||
    "";
  return raw ? raw.split(/[\s._-]/)[0] : null;
}

export default function Chat() {
  const { agent } = useVibeyAgent();
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sticky-bottom: only auto-scroll if the user is already near the bottom.
  const stickToBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Load prior unified-conversation history (web + Telegram) for signed-in users.
  useEffect(() => {
    if (historyLoaded) return;
    const intro = buildIntro(firstName(session));
    if (!session?.user) {
      // Anonymous: show personalized intro once.
      if (messages.length === 0) {
        setMessages([{ id: "intro", role: "assistant", content: intro }]);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .limit(20);
      if (cancelled) return;
      const bestUser = pickBestProfile(userRow as Array<{ id: string }> | null);
      if (!bestUser?.id) {
        setHistoryLoaded(true);
        return;
      }
      const { data: logs } = await supabase
        .from("agent_chat_logs")
        .select("id, user_message, agent_response, created_at")
        .eq("session_key", `user:${bestUser.id}`)
        .order("created_at", { ascending: true })
        .limit(50);
      if (cancelled) return;
      const hydrated: Message[] = [
        { id: "intro", role: "assistant", content: intro },
      ];
      for (const row of logs ?? []) {
        hydrated.push({ id: `u-${row.id}`, role: "user", content: row.user_message });
        hydrated.push({ id: `a-${row.id}`, role: "assistant", content: row.agent_response });
      }
      setMessages(hydrated);
      setHistoryLoaded(true);
      // Scroll to bottom on initial load.
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, historyLoaded]);


  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendText = (text: string) => {
    setInput(text);
    // Defer to next tick so the input value is set before send.
    setTimeout(() => {
      const fakeEvent = new Event("submit");
      void fakeEvent;
      handleSendWith(text);
    }, 0);
  };

  const handleSendWith = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);
    stickToBottomRef.current = true;

    const HISTORY_CAP = 20;
    const payloadMessages = [...messages, userMsg]
      .slice(-HISTORY_CAP)
      .map(({ role, content }) => ({ role, content }));

    try {
      // Use the signed-in user's JWT when available so the edge function can
      // identify them and persist the conversation under their unified key.
      const accessToken = session?.access_token ?? supabasePublishableKey;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        if (resp.status === 429) {
          toast.error("Rate limited", { description: "Slow down — try again in a moment." });
        } else if (resp.status === 402) {
          toast.error("Out of credits", { description: "Top up your OpenRouter balance." });
        } else {
          toast.error("Vibey couldn't reply", { description: errText || `HTTP ${resp.status}` });
        }
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      // Track which SSE event the next "data:" line belongs to. OpenRouter
      // chunks are unnamed (default "message"); our edge function appends a
      // single "event: images" envelope at the very end.
      let pendingEvent: string | null = null;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);

          // Blank line = end of one SSE event.
          if (line === "") {
            pendingEvent = null;
            continue;
          }
          if (line.startsWith(":")) continue;

          if (line.startsWith("event: ")) {
            pendingEvent = line.slice(7).trim();
            continue;
          }

          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();

          // Custom event: gallery image attachments
          if (pendingEvent === "images") {
            try {
              const imgs: GalleryImage[] = JSON.parse(payload);
              if (Array.isArray(imgs) && imgs.length > 0) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, images: imgs } : m))
                );
              }
            } catch {
              // ignore malformed image payloads
            }
            continue;
          }

          // Custom event: tool call breadcrumbs (start/done with playful labels)
          if (pendingEvent === "tool") {
            try {
              const evt = JSON.parse(payload) as ToolEvent;
              if (evt && evt.id && evt.label) {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const tools = m.tools ? [...m.tools] : [];
                    const idx = tools.findIndex((t) => t.id === evt.id);
                    if (idx >= 0) tools[idx] = evt;
                    else tools.push(evt);
                    return { ...m, tools };
                  })
                );
              }
            } catch {
              // ignore malformed tool payloads
            }
            continue;
          }

          if (payload === "[DONE]") {
            done = true;
            break;
          }

          try {
            const parsed = JSON.parse(payload);
            const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
              );
            }
          } catch {
            // partial JSON — put line back and wait for more data
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection error", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  };

  const showEmptyState = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto p-6 space-y-4">
        {showEmptyState ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden ring-1 ring-primary/20">
              <img src={vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Talk to {agent?.name ?? "Vibey"}</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Your community's AI brain is ready to chat.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-primary/20 shrink-0 mt-1">
                  <img src={vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
                </div>
              )}
              <div className={`max-w-[70%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {/* Tool-call breadcrumbs — playful peek at what Vibey is doing */}
                {msg.role === "assistant" && msg.tools && msg.tools.length > 0 && (
                  <div className="flex flex-col gap-1 w-full">
                    <AnimatePresence initial={false}>
                      {msg.tools.map((t) => (
                        <motion.div
                          key={t.id + ":" + t.status}
                          initial={{ opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="self-start max-w-full"
                        >
                          {t.status === "thought" ? (
                            <div className="flex gap-1.5 text-[11px] italic leading-snug px-2 py-1 text-muted-foreground/70 max-w-full">
                              <span className="shrink-0">💭</span>
                              <span className="whitespace-pre-wrap">{t.label}</span>
                            </div>
                          ) : (
                            <>
                              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md bg-muted/60 border border-border text-muted-foreground">
                                {t.status === "start" && (
                                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                )}
                                <span className="truncate">{t.label}</span>
                              </div>
                              {t.details && (
                                <pre className="mt-1 text-[10.5px] font-mono whitespace-pre-wrap leading-snug px-2 py-1.5 rounded-md bg-muted/40 border border-border/60 text-muted-foreground max-w-full overflow-x-auto">
{t.details}
                                </pre>
                              )}
                            </>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
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

                {/* Gallery image cards (assistant-only) */}
                {msg.role === "assistant" && msg.images && msg.images.length > 0 && (
                  <div
                    className={`grid gap-2 w-full ${
                      msg.images.length === 1
                        ? "grid-cols-1"
                        : msg.images.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-3"
                    }`}
                  >
                    {msg.images.map((img) => (
                      <a
                        key={img.id}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-lg overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors"
                      >
                        <div className="aspect-square overflow-hidden bg-muted">
                          <img
                            src={img.url}
                            alt={img.title || "Gallery photo"}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        {img.title && (
                          <div className="p-2 text-xs text-muted-foreground truncate">
                            {img.title}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
        {/* Suggestion chips — show only when intro is the sole message */}
        {messages.length === 1 && messages[0].id === "intro" && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 pl-10"
          >
            {STARTER_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => handleSendWith(p)}
                className="text-xs font-mono px-3 py-1.5 rounded-full bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
              >
                {p}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendWith();
          }}
          className="flex gap-2 max-w-3xl mx-auto"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${agent?.name ?? "Vibey"}…`}
            className="flex-1 bg-card border-border"
            disabled={isStreaming}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setVoiceOpen(true)}
            disabled={isStreaming}
            title="Talk to Vibey"
          >
            <AudioLines className="h-4 w-4" />
          </Button>
          <Button type="submit" size="icon" disabled={!input.trim() || isStreaming}>
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      <VoiceMode
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        agentName={agent?.name ?? "Vibey"}
      />
    </div>
  );
}
