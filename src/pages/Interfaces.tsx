import { PageShell } from "@/components/PageShell";
import { Switch } from "@/components/ui/switch";

const interfaces = [
  { name: "Telegram Bot", description: "Connect Vibey to a Telegram group", enabled: true },
  { name: "Web Chat Widget", description: "Embed a chat widget on your site", enabled: false },
  { name: "Voice Agent", description: "Enable voice conversations via ElevenLabs", enabled: false },
];

export default function Interfaces() {
  return (
    <PageShell title="Interfaces" description="Enable and configure Vibey's communication channels.">
      <div className="space-y-3 max-w-lg">
        {interfaces.map((iface) => (
          <div
            key={iface.name}
            className="flex items-center justify-between p-4 rounded-lg bg-card border border-border"
          >
            <div>
              <p className="text-sm font-medium">{iface.name}</p>
              <p className="text-xs text-muted-foreground">{iface.description}</p>
            </div>
            <Switch defaultChecked={iface.enabled} />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Mock data — toggles won't persist until Supabase is connected.
        </p>
      </div>
    </PageShell>
  );
}
