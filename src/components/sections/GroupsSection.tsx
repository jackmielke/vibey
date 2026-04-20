import { UsersRound } from "lucide-react";

export function GroupsSection() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
        <UsersRound className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">No group chats configured yet</p>
    </div>
  );
}
