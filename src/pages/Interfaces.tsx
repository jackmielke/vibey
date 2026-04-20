import { PageShell } from "@/components/PageShell";
import { InterfacesSection } from "@/components/sections/InterfacesSection";

export default function Interfaces() {
  return (
    <PageShell title="Interfaces" description="Enable and configure Vibey's communication channels.">
      <InterfacesSection />
    </PageShell>
  );
}
