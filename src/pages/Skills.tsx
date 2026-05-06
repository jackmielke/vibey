import { PageShell } from "@/components/PageShell";

export default function Skills() {
  return (
    <PageShell
      title="Skills"
      description="On-demand prompts Vibey can invoke. Skills are lightweight playbooks — describe a behavior and Vibey can call it mid-conversation. Tools, by contrast, are concrete actions and API calls."
    >
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No skills defined yet. This is where you'll author reusable prompts Vibey can pull from.
        </p>
      </div>
    </PageShell>
  );
}
