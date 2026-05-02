import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { Loader2 } from "lucide-react";
import { ModelSection } from "@/components/sections/ModelSection";

export function IdentitySection() {
  const { agent, loading, saving, save } = useVibeyAgent();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [intro, setIntro] = useState("");

  useEffect(() => {
    if (agent) {
      setName(agent.name ?? "");
      setAvatar(agent.avatar_url ?? "");
      setIntro(agent.intro_message ?? "");
    }
  }, [agent]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const commit = (key: "name" | "avatar_url" | "intro_message", next: string) => {
    if (!agent) return;
    const current = (agent[key] ?? "") as string;
    if (next !== current) save({ [key]: next || null } as never);
  };

  return (
    <div className="grid gap-6 max-w-lg">
      <div className="space-y-2">
        <label className="text-label">Agent Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => commit("name", name)}
          className="bg-card border-border"
        />
      </div>
      <div className="space-y-2">
        <label className="text-label">Avatar URL</label>
        <Input
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          onBlur={() => commit("avatar_url", avatar)}
          placeholder="https://..."
          className="bg-card border-border"
        />
      </div>
      <div className="space-y-2">
        <label className="text-label">Intro Message</label>
        <Input
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          onBlur={() => commit("intro_message", intro)}
          className="bg-card border-border"
        />
      </div>
      <ModelSection />
      <p className="text-xs text-muted-foreground">
        {saving ? "Saving…" : "Saves automatically when you click away."}
      </p>
    </div>
  );
}
