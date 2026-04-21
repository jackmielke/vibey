import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { Loader2 } from "lucide-react";

export function SoulSection() {
  const { agent, loading, saving, save } = useVibeyAgent();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (agent) setValue(agent.system_prompt ?? "");
  }, [agent]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="text-label">System Prompt</label>
      <Textarea
        rows={16}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (agent && value !== agent.system_prompt) {
            save({ system_prompt: value });
          }
        }}
        placeholder="You are Vibey, a warm and witty AI community concierge..."
        className="bg-card border-border font-mono text-sm resize-none"
      />
      <p className="text-xs text-muted-foreground">
        {saving ? "Saving…" : "Saves automatically when you click away."}
      </p>
    </div>
  );
}
