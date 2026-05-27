import { PageShell } from "@/components/PageShell";
import { ConversationsSection } from "@/components/sections/ConversationsSection";

export default function Conversations() {
  return (
    <PageShell
      title="Conversations"
      description="Group chats and DMs in one place. Toggle who Vibey replies to."
    >
      <ConversationsSection />
    </PageShell>
  );
}
