import { PageShell } from "@/components/PageShell";
import { InterfacesSection } from "@/components/sections/InterfacesSection";

export default function Interfaces() {
  return (
    <PageShell title="Interface Config" description="Enable and configure Vibey's communication channels.">
      <InterfacesSection />
    </PageShell>
  );
}
