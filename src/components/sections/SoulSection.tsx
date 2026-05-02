import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { Loader2 } from "lucide-react";

export function SoulSection() {
  const { agent, loading, saving, save } = useVibeyAgent();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (agent) setValue(agent.system_prompt ?? "");
  }, [agent]);

  // Auto-grow textarea so the full prompt is visible without an inner scrollbar.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (agent && value !== agent.system_prompt) {
            save({ system_prompt: value });
          }
        }}
        placeholder="You are Vibey, a warm and witty AI community concierge..."
        className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 p-0 font-mono text-sm leading-relaxed resize-none text-foreground placeholder:text-muted-foreground"
      />
      <p className="text-xs text-muted-foreground">
        {saving ? "Saving…" : "Saves automatically when you click away."}
      </p>
    </div>
  );
}
