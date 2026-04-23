import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { toast } from "sonner";
import vibeyAvatar from "@/assets/vibey-avatar.png";

interface GalleryImage {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: GalleryImage[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-vibey`;

export default function Chat() {
  const { agent } = useVibeyAgent();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sticky-bottom: only auto-scroll if the user is already near the bottom.
  const stickToBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (agent && messages.length === 0 && agent.intro_message) {
      setMessages([{ id: "intro", role: "assistant", content: agent.intro_message }]);
    }
  }, [agent, messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
              <img src={agent?.avatar_url || vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
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
                  <img src={agent?.avatar_url || vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
                </div>
              )}
              <div className={`max-w-[70%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
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
      </div>

      {/* Input bar */}
      <div className="border-t border-border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
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
          <Button type="submit" size="icon" disabled={!input.trim() || isStreaming}>
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
