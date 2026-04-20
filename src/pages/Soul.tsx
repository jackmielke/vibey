import { PageShell } from "@/components/PageShell";
import { Textarea } from "@/components/ui/textarea";

export default function Soul() {
  return (
    <PageShell title="Soul" description="Define Vibey's core personality, values, and behavioral guidelines.">
      <div className="space-y-4">
        <label className="text-label">System Prompt</label>
        <Textarea
          rows={16}
          placeholder="You are Vibey, a warm and witty AI community concierge..."
          className="bg-card border-border font-mono text-sm resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Mock data — changes won't persist until Supabase is connected.
        </p>
      </div>
    </PageShell>
  );
}
