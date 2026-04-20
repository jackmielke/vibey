import { PageShell } from "@/components/PageShell";
import { MessagesSquare } from "lucide-react";

export default function Conversations() {
  return (
    <PageShell title="Conversations" description="View Vibey's conversation history with community members.">
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
          <MessagesSquare className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No conversations yet</p>
      </div>
    </PageShell>
  );
}
