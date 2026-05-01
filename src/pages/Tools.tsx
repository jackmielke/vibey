import { PageShell } from "@/components/PageShell";
import { ToolsSection } from "@/components/sections/ToolsSection";

export default function Tools() {
  return (
    <PageShell title="Tools" description="Capabilities Vibey can call during a conversation.">
      <ToolsSection />
    </PageShell>
  );
}
