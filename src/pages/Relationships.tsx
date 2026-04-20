import { PageShell } from "@/components/PageShell";
import { Users } from "lucide-react";

export default function Relationships() {
  return (
    <PageShell title="Relationships" description="Browse Vibey's relationships with community members.">
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
          <Users className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No relationships tracked yet</p>
      </div>
    </PageShell>
  );
}
