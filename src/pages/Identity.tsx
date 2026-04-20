import { PageShell } from "@/components/PageShell";
import { Input } from "@/components/ui/input";

export default function Identity() {
  return (
    <PageShell title="Identity" description="Customize Vibey's name, avatar, and personality traits.">
      <div className="grid gap-6 max-w-lg">
        <div className="space-y-2">
          <label className="text-label">Agent Name</label>
          <Input defaultValue="Vibey" className="bg-card border-border" />
        </div>
        <div className="space-y-2">
          <label className="text-label">Avatar URL</label>
          <Input placeholder="https://..." className="bg-card border-border" />
        </div>
        <div className="space-y-2">
          <label className="text-label">Intro Message</label>
          <Input defaultValue="Hey! I'm Vibey 👋" className="bg-card border-border" />
        </div>
        <p className="text-xs text-muted-foreground">
          Mock data — changes won't persist until Supabase is connected.
        </p>
      </div>
    </PageShell>
  );
}
