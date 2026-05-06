import { PageShell } from "@/components/PageShell";
import { SkillsSection } from "@/components/sections/SkillsSection";

export default function Skills() {
  return (
    <PageShell
      title="Skills"
      description="On-demand prompt playbooks Vibey can invoke. Skills are lightweight behaviors — describe one and Vibey can call it mid-conversation. Tools, by contrast, are concrete API calls."
    >
      <SkillsSection />
    </PageShell>
  );
}
