import { Brain } from "lucide-react";

export function MemorySection() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
        <Brain className="w-6 h-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">No memories yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Memories will appear here once Supabase is connected.
        </p>
      </div>
    </div>
  );
}
