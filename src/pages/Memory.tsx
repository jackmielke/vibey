import { PageShell } from "@/components/PageShell";
import { MemorySection } from "@/components/sections/MemorySection";

export default function Memory() {
  return (
    <PageShell title="Memory" description="View and manage Vibey's stored memories and knowledge.">
      <MemorySection />
    </PageShell>
  );
}
