import { useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import vibeyAvatar from "@/assets/vibey-avatar.png";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const mockMessages: Message[] = [
  { id: "1", role: "assistant", content: "Hey! I'm Vibey, your community's AI brain. What's on your mind?" },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "This is a placeholder response. Connect Supabase to enable real AI chat.",
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden ring-1 ring-primary/20">
              <img src={vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Talk to Vibey</h2>
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
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                {msg.content}
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
            placeholder="Message Vibey…"
            className="flex-1 bg-card border-border"
          />
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
