import { PageShell } from "@/components/PageShell";
import { RelationshipsSection } from "@/components/sections/RelationshipsSection";

export default function Relationships() {
  return (
    <PageShell title="Preferences" description="What Vibey knows about each person — preferences, context, and relationship notes.">
      <RelationshipsSection />
    </PageShell>
  );
}
