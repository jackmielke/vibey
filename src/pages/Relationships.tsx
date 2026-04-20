import { PageShell } from "@/components/PageShell";
import { RelationshipsSection } from "@/components/sections/RelationshipsSection";

export default function Relationships() {
  return (
    <PageShell title="Relationships" description="Browse Vibey's relationships with community members.">
      <RelationshipsSection />
    </PageShell>
  );
}
