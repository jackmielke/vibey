import { PageShell } from "@/components/PageShell";
import { IdentitySection } from "@/components/sections/IdentitySection";

export default function Identity() {
  return (
    <PageShell title="Identity" description="Customize Vibey's name, avatar, and personality traits.">
      <IdentitySection />
    </PageShell>
  );
}
