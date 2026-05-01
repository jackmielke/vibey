import { PageShell } from "@/components/PageShell";
import { SoulSection } from "@/components/sections/SoulSection";
import { IdentitySection } from "@/components/sections/IdentitySection";

export default function Soul() {
  return (
    <PageShell title="Soul" description="Define Vibey's core personality, values, and behavioral guidelines.">
      <div className="space-y-10">
        <SoulSection />

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
              Identity
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Name, avatar, and the first thing Vibey says when meeting someone.
            </p>
          </div>
          <IdentitySection />
        </div>
      </div>
    </PageShell>
  );
}
