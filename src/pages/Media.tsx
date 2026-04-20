import { PageShell } from "@/components/PageShell";
import { MediaSection } from "@/components/sections/MediaSection";

export default function Media() {
  return (
    <PageShell title="Media Library" description="Manage images, videos, and other media assets.">
      <MediaSection />
    </PageShell>
  );
}
