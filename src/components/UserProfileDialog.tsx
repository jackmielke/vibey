import { useEffect, useState } from "react";
import { Loader2, Sparkles, ShieldCheck, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { pickBestProfile } from "@/lib/profiles";
import { toast } from "sonner";

type Profile = {
  id: string;
  name: string | null;
  username: string | null;
  telegram_username: string | null;
  telegram_user_id: number | null;
  telegram_photo_url: string | null;
  avatar_url: string | null;
  email: string | null;
  bio: string | null;
  headline: string | null;
  intentions: string | null;
  interests_skills: string[] | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
  phone_number: string | null;
  phone_verified: boolean | null;
  world_id_verified: boolean | null;
  is_vibe_resident: boolean | null;
  vibe_resident_at: string | null;
  is_claimed: boolean | null;
  created_at: string | null;
};

const SELECT =
  "id, name, username, telegram_username, telegram_user_id, telegram_photo_url, avatar_url, email, bio, headline, intentions, interests_skills, instagram_handle, twitter_handle, phone_number, phone_verified, world_id_verified, is_vibe_resident, vibe_resident_at, is_claimed, created_at";

export function UserProfileDialog({
  open,
  onOpenChange,
  lookup,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // lookup by either telegram id or username; we'll pick the best matching row
  lookup: { telegramUserId?: number | null; telegramUsername?: string | null } | null;
  onChanged?: (profile: Profile) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!open || !lookup) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setProfile(null);
      let query = supabase.from("users").select(SELECT).limit(20);
      const orClauses: string[] = [];
      if (lookup.telegramUserId) orClauses.push(`telegram_user_id.eq.${lookup.telegramUserId}`);
      if (lookup.telegramUsername) {
        const u = lookup.telegramUsername.replace(/^@/, "");
        orClauses.push(`telegram_username.eq.${u}`);
      }
      if (orClauses.length === 0) {
        setLoading(false);
        return;
      }
      query = query.or(orClauses.join(","));
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load profile", { description: error.message });
        setLoading(false);
        return;
      }
      setProfile(pickBestProfile(data as Profile[] | null));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lookup?.telegramUserId, lookup?.telegramUsername]);

  const setResident = async (next: boolean) => {
    if (!profile) return;
    setUpdating(true);
    const patch = {
      is_vibe_resident: next,
      vibe_resident_at: next ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase
      .from("users")
      .update(patch)
      .eq("id", profile.id)
      .select(SELECT)
      .maybeSingle();
    setUpdating(false);
    if (error || !data) {
      toast.error("Couldn't update", { description: error?.message ?? "No row updated" });
      return;
    }
    const updated = data as Profile;
    setProfile(updated);
    onChanged?.(updated);
    toast.success(next ? "Marked as Vibe resident" : "Removed Vibe resident status");
  };

  const name = profile?.name || profile?.telegram_username || "Unknown";
  const handle = profile?.telegram_username || profile?.username;
  const photoUrl = profile?.telegram_photo_url || profile?.avatar_url || undefined;
  const initials = name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && !profile && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No matching profile found.
          </div>
        )}
        {!loading && profile && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 ring-1 ring-border">
                  {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
                  <AvatarFallback className="text-sm font-mono">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate">{name}</DialogTitle>
                  {handle && (
                    <DialogDescription className="font-mono text-xs">@{handle}</DialogDescription>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {profile.is_vibe_resident && (
                      <Badge className="text-[10px] gap-1 bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">
                        <Sparkles className="w-2.5 h-2.5" /> Vibe resident
                      </Badge>
                    )}
                    {profile.world_id_verified && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <ShieldCheck className="w-2.5 h-2.5" /> World ID
                      </Badge>
                    )}
                    {profile.phone_verified && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Phone className="w-2.5 h-2.5" /> Phone
                      </Badge>
                    )}
                    {profile.is_claimed === false && (
                      <Badge variant="outline" className="text-[10px]">unclaimed</Badge>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-md border border-border p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  Vibe resident
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {profile.is_vibe_resident
                    ? `Since ${profile.vibe_resident_at ? new Date(profile.vibe_resident_at).toLocaleDateString() : "—"}`
                    : "Not currently a resident"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {updating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                <Switch
                  checked={!!profile.is_vibe_resident}
                  disabled={updating}
                  onCheckedChange={setResident}
                />
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {profile.headline && <Field label="Headline" value={profile.headline} />}
              {profile.bio && <Field label="Bio" value={profile.bio} multiline />}
              {profile.intentions && (
                <Field label="Intentions" value={profile.intentions} multiline />
              )}
              {profile.interests_skills && profile.interests_skills.length > 0 && (
                <div>
                  <div className="text-label mb-1">Interests & skills</div>
                  <div className="flex flex-wrap gap-1">
                    {profile.interests_skills.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" value={profile.email} />
                <Field
                  label="Phone"
                  value={
                    profile.phone_number
                      ? `${profile.phone_number}${profile.phone_verified ? " ✓" : ""}`
                      : null
                  }
                />
                <Field
                  label="Telegram"
                  value={
                    profile.telegram_username
                      ? `@${profile.telegram_username}`
                      : profile.telegram_user_id
                      ? String(profile.telegram_user_id)
                      : null
                  }
                />
                <Field
                  label="Instagram"
                  value={profile.instagram_handle ? `@${profile.instagram_handle}` : null}
                />
                <Field
                  label="Twitter"
                  value={profile.twitter_handle ? `@${profile.twitter_handle}` : null}
                />
                <Field
                  label="Joined"
                  value={profile.created_at ? new Date(profile.created_at).toLocaleDateString() : null}
                />
              </div>

              <div className="pt-2 border-t border-border">
                <Field label="User ID" value={profile.id} mono />
              </div>
            </div>
          </>
        )}
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
