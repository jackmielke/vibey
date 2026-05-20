import { useEffect, useState } from "react";
import { LogOut, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, signOut } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { pickBestProfile } from "@/lib/profiles";

type Profile = {
  id: string | null;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  telegram_username: string | null;
  telegram_user_id: number | null;
  telegram_photo_url: string | null;
  email: string | null;
  bio: string | null;
  headline: string | null;
  intentions: string | null;
  interests_skills: string[] | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
  phone_number: string | null;
  phone_verified: boolean | null;
  vibecoin_balance: number | null;
  wallet_address: string | null;
  wallet_provider: string | null;
  world_id_verified: boolean | null;
  universal_id: string | null;
  created_at: string | null;
};

export function SidebarUserProfile({ collapsed }: { collapsed: boolean }) {
  const { session, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select(
          "id, name, username, avatar_url, telegram_username, telegram_user_id, telegram_photo_url, email, bio, headline, intentions, interests_skills, instagram_handle, twitter_handle, phone_number, phone_verified, vibecoin_balance, wallet_address, wallet_provider, world_id_verified, universal_id, created_at"
        )
        .eq("auth_user_id", session.user.id)
        .limit(20);
      if (!cancelled) setProfile(pickBestProfile(data as Profile[] | null));
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
  const avatarUrl = profile?.avatar_url || profile?.telegram_photo_url || undefined;
  const initials = (name || "?")
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-sidebar-accent rounded p-1 -m-1 transition-colors"
            title="View profile"
          >
            <Avatar className="h-7 w-7 ring-1 ring-border shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
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
          </button>
        </DialogTrigger>
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

      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 ring-1 ring-border">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="text-sm font-mono">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="truncate">{name}</DialogTitle>
              {handle && (
                <DialogDescription className="font-mono text-xs">@{handle}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {profile?.headline && (
            <Field label="Headline" value={profile.headline} />
          )}
          {profile?.bio && <Field label="Bio" value={profile.bio} multiline />}
          {profile?.intentions && (
            <Field label="Intentions" value={profile.intentions} multiline />
          )}

          {profile?.interests_skills && profile.interests_skills.length > 0 && (
            <div>
              <div className="text-label mb-1">Interests & skills</div>
              <div className="flex flex-wrap gap-1">
                {profile.interests_skills.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" value={profile?.email || session.user.email || null} />
            <Field
              label="Phone"
              value={
                profile?.phone_number
                  ? `${profile.phone_number}${profile.phone_verified ? " ✓" : ""}`
                  : null
              }
            />
            <Field
              label="Telegram"
              value={
                profile?.telegram_username
                  ? `@${profile.telegram_username}`
                  : profile?.telegram_user_id
                  ? String(profile.telegram_user_id)
                  : null
              }
            />
            <Field
              label="Instagram"
              value={profile?.instagram_handle ? `@${profile.instagram_handle}` : null}
            />
            <Field
              label="Twitter"
              value={profile?.twitter_handle ? `@${profile.twitter_handle}` : null}
            />
            <Field
              label="VibeCoin"
              value={
                profile?.vibecoin_balance != null ? String(profile.vibecoin_balance) : null
              }
            />
            <Field
              label="World ID"
              value={profile?.world_id_verified ? "Verified" : null}
            />
            <Field
              label="Wallet"
              value={
                profile?.wallet_address
                  ? `${profile.wallet_address.slice(0, 6)}…${profile.wallet_address.slice(-4)}${
                      profile.wallet_provider ? ` (${profile.wallet_provider})` : ""
                    }`
                  : null
              }
            />
          </div>

          <div className="pt-2 border-t border-border space-y-1">
            <Field label="Universal ID" value={profile?.universal_id} mono />
            <Field label="User ID" value={profile?.id} mono />
            <Field
              label="Joined"
              value={
                profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : null
              }
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
            >
              <LogOut className="h-3 w-3 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  multiline,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <div className="text-label mb-0.5">{label}</div>
      <div
        className={`text-foreground break-words ${mono ? "font-mono text-[10px]" : "text-xs"} ${
          multiline ? "whitespace-pre-wrap" : "truncate"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
