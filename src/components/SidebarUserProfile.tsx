import { useEffect, useState } from "react";
import { LogOut, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, signOut } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  telegram_username: string | null;
};

export function SidebarUserProfile({ collapsed }: { collapsed: boolean }) {
  const { session, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("name, username, avatar_url, telegram_username")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (!cancelled) setProfile(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  if (loading) return null;

  if (!session?.user) {
    return (
      <Link
        to="/login"
        className="flex items-center gap-2 text-label hover:text-foreground transition-colors"
      >
        <LogIn className="h-3 w-3 shrink-0" />
        {!collapsed && <span>Sign in</span>}
      </Link>
    );
  }

  const name = profile?.name || session.user.email?.split("@")[0] || "You";
  const handle = profile?.telegram_username || profile?.username;
  const initials = (name || "?")
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-7 w-7 ring-1 ring-border shrink-0">
        {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
        <AvatarFallback className="text-[10px] font-mono">{initials}</AvatarFallback>
      </Avatar>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate text-foreground">{name}</div>
          {handle && (
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              @{handle}
            </div>
          )}
        </div>
      )}
      {!collapsed && (
        <button
          type="button"
          onClick={() => signOut()}
          title="Sign out"
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <LogOut className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
