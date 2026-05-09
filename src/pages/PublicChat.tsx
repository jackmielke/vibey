import Chat from "./Chat";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import vibeyAvatar from "@/assets/vibey-avatar.png";

export default function PublicChat() {
  const { agent } = useVibeyAgent();
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-primary/20">
          <img
            src={agent?.avatar_url || vibeyAvatar}
            alt={agent?.name ?? "Vibey"}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{agent?.name ?? "Vibey"}</span>
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            public chat
          </span>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <Chat />
      </div>
    </div>
  );
}
