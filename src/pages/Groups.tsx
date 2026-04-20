import { PageShell } from "@/components/PageShell";
import { GroupsSection } from "@/components/sections/GroupsSection";

export default function Groups() {
  return (
    <PageShell title="Group Chats" description="Manage Vibey's presence in group conversations.">
      <GroupsSection />
    </PageShell>
  );
}
