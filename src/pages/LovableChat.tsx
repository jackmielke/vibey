import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lovable-chat`;

export default function LovableChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    setMessages((p) => [...p, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);
    stickRef.current = true;

    const payload = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: payload }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Rate limited", { description: "Try again shortly." });
        else if (resp.status === 402) toast.error("Out of credits", { description: "Top up at Workspace → Usage." });
        else toast.error("Chat failed", { description: `HTTP ${resp.status}` });
        setMessages((p) => p.filter((m) => m.id !== assistantId));
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
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((p) =>
                p.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
              );
            }
          } catch {
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
      setMessages((p) => p.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto p-6 space-y-4">
        {empty ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Lovable AI Chat</h2>
              <p className="text-muted-foreground text-sm mt-1 font-mono">
                google/gemini-3-flash-preview · via Lovable AI Gateway
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "bg-card border border-border prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-pre:my-2"
                }`}
              >
                {m.role === "assistant" ? (
                  m.content ? (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-muted-foreground not-prose">
                      <Loader2 className="w-3 h-3 animate-spin" /> thinking…
                    </span>
                  )
                ) : (
                  m.content
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="border-t border-border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2 max-w-3xl mx-auto"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Gemini anything…"
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
