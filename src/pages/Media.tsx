import { PageShell } from "@/components/PageShell";
import { Image } from "lucide-react";

export default function Media() {
  return (
    <PageShell title="Media Library" description="Manage images, videos, and other media assets.">
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
          <Image className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No media uploaded yet</p>
      </div>
    </PageShell>
  );
}
