import { PageShell } from "@/components/PageShell";
import { ConversationsSection } from "@/components/sections/ConversationsSection";

export default function Conversations() {
  return (
    <PageShell title="Chat History" description="View Vibey's conversation history with community members.">
      <ConversationsSection />
    </PageShell>
  );
}
