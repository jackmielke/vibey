import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { toast } from "sonner";
import vibeyAvatar from "@/assets/vibey-avatar.png";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-vibey`;

export default function Chat() {
  const { agent } = useVibeyAgent();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed with the agent's intro message once it loads.
  useEffect(() => {
    if (agent && messages.length === 0 && agent.intro_message) {
      setMessages([{ id: "intro", role: "assistant", content: agent.intro_message }]);
    }
  }, [agent, messages.length]);

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    // Build the payload from the conversation so far (excluding the empty assistant placeholder).
    // Cap to the last 20 messages (~10 turns) so context/cost stay predictable as conversations grow.
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
        // Remove the empty assistant placeholder
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const payload = line.slice(6).trim();
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
      <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
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
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
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
