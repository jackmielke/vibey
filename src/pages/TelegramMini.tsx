import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Brain,
  Tag,
  Share2,
  Heart,
  Sparkles,
  Filter,
  Check,
  Pencil,
  Shield,
  Trash2,
  MessageSquare,
  Plus,
  X,
  Calendar,
  Clock,
  MapPin,
  Users as UsersIcon,
  Coins,
  Zap,
} from "lucide-react";
import { formatMemoryForTelegram, buildTelegramShareUrl } from "@/lib/shareMemory";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { VIBEY_COMMUNITY_ID, VIBE_CODE_RESIDENCY_COMMUNITY_ID } from "@/lib/vibey";
import { toast } from "sonner";
import vibeyAvatar from "@/assets/vibey-avatar.png";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCredits, formatTokens } from "@/lib/usage";
import { pickBestProfile } from "@/lib/profiles";

const PREFERENCE_COMMUNITIES: { community_id: string; agent_id: string; label: string }[] = [
  {
    community_id: VIBEY_COMMUNITY_ID,
    agent_id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    label: "with vibey",
  },
];

const PREFERENCE_COMMUNITY_IDS = PREFERENCE_COMMUNITIES.map((c) => c.community_id);

const PREFERENCE_SUGGESTIONS = [
  "please call me sir",
  "use all lowercase and be extra vibey",
  "keep replies under 3 sentences",
  "no emojis, ever",
  "be brutally honest with me",
  "match my energy — playful and curious",
];

type MemoryRow = {
  id: string;
  title: string | null;
  content: string | null;
  tags: string[] | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type PreferenceRow = {
  id: string;
  community_id: string;
  telegram_user_id?: number | null;
  relationship_notes: string | null;
  display_name: string | null;
  updated_at: string | null;
};

type MiniProfile = {
  id: string;
  auth_user_id?: string | null;
  name: string | null;
  username?: string | null;
  avatar_url: string | null;
  profile_picture_url?: string | null;
  telegram_photo_url: string | null;
  telegram_user_id?: number | null;
  telegram_username: string | null;
  headline: string | null;
  bio: string | null;
  email: string | null;
  intentions?: string | null;
  interests_skills?: string[] | null;
  instagram_handle?: string | null;
  twitter_handle?: string | null;
  source_url?: string | null;
  phone_number?: string | null;
  vibecoin_balance?: number | null;
  world_id_verified?: boolean | null;
  created_at?: string | null;
};

const MINI_PROFILE_COLUMNS =
  "id, auth_user_id, name, username, avatar_url, profile_picture_url, telegram_photo_url, telegram_user_id, telegram_username, headline, bio, email, intentions, interests_skills, instagram_handle, twitter_handle, source_url, phone_number, vibecoin_balance, world_id_verified, created_at";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_start_time: string;
  event_end_time: string;
  event_location: string | null;
  event_type: string | null;
  event_image_url: string | null;
  hosted_by: string | null;
  is_featured: boolean | null;
  tags: string[] | null;
};

type ChatLogRow = {
  id: string;
  user_message: string;
  agent_response: string;
  telegram_username: string | null;
  telegram_user_id: number | null;
  created_at: string;
  total_tokens: number | null;
  cost_credits: number | null;
  openrouter_model: string | null;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: { user?: { id?: number; first_name?: string } };
        ready: () => void;
        expand: () => void;
        colorScheme?: "light" | "dark";
        themeParams?: Record<string, string>;
        MainButton?: { hide: () => void };
      };
    };
  }
}

type AuthState = "loading" | "ready" | "error";

function memorySource(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const username = metadata.telegram_username as string | undefined;
  const source = metadata.source as string | undefined;
  if (username) return `@${username}`;
  if (source === "telegram_group") return "telegram group";
  if (source === "telegram_dm") return "telegram dm";
  if (source === "telegram_agent") return "telegram";
  if (source === "web") return "web chat";
  if (source === "admin_panel") return "admin";
  return null;
}

const URL_REGEX = /(https?:\/\/[^\s)]+)/g;

function renderWithLinks(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function MemoryCard({
  m,
  highlight,
  adminMode,
  onEdit,
  onDelete,
}: {
  m: MemoryRow;
  highlight?: boolean;
  adminMode?: boolean;
  onEdit?: (m: MemoryRow) => void;
  onDelete?: (m: MemoryRow) => void;
}) {
  const source = memorySource(m.metadata);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={
        "p-3 rounded-lg bg-card border overflow-hidden " +
        (highlight ? "border-primary/40" : "border-border")
      }
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          {m.title && (
            <p className="text-sm font-semibold mb-1 break-words [overflow-wrap:anywhere]">
              {m.title}
            </p>
          )}
          <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere] text-muted-foreground">
            {m.content ? renderWithLinks(m.content) : null}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {adminMode && onEdit && (
            <button
              onClick={() => onEdit(m)}
              className="text-muted-foreground hover:text-primary p-1"
              aria-label="Edit memory"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {adminMode && onDelete && (
            <button
              onClick={() => onDelete(m)}
              className="text-muted-foreground hover:text-destructive p-1"
              aria-label="Delete memory"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <a
            href={buildTelegramShareUrl(formatMemoryForTelegram(m))}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary p-1"
            aria-label="Share to Telegram"
          >
            <Share2 className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <span className="text-[10px] text-muted-foreground font-mono">
          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
        </span>
        {source && (
          <span className="text-[10px] text-muted-foreground font-mono">
            via {source}
          </span>
        )}
        {m.tags && m.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="w-3 h-3 text-muted-foreground" />
            {m.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PreferenceEditor({
  community_id,
  agent_id,
  label,
  existing,
  saving,
  saved,
  onSave,
}: {
  community_id: string;
  agent_id: string;
  label: string;
  existing: PreferenceRow | null;
  saving: boolean;
  saved: boolean;
  onSave: (notes: string) => void;
}) {
  const initial = existing?.relationship_notes ?? "";
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(!initial);

  useEffect(() => {
    setValue(existing?.relationship_notes ?? "");
  }, [existing?.id, existing?.relationship_notes]);

  const dirty = value.trim() !== (existing?.relationship_notes ?? "").trim();
  const isEmpty = !(existing?.relationship_notes ?? "").trim();

  return (
    <div className="p-3 rounded-lg bg-card border border-primary/30 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {!editing && !isEmpty && (
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" /> edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. call me sir, keep it short, no emojis"
            rows={3}
            className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60 resize-y font-sans"
          />

          {!value.trim() && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                try one
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setValue(s)}
                    className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-muted-foreground font-mono">
              {existing?.updated_at
                ? `updated ${formatDistanceToNow(new Date(existing.updated_at), { addSuffix: true })}`
                : "not set yet"}
            </p>
            <div className="flex items-center gap-2">
              {!isEmpty && (
                <button
                  onClick={() => {
                    setValue(existing?.relationship_notes ?? "");
                    setEditing(false);
                  }}
                  className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  cancel
                </button>
              )}
              <button
                onClick={() => {
                  onSave(value);
                  setEditing(false);
                }}
                disabled={saving || !dirty}
                className="text-[11px] font-mono uppercase tracking-widest px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : saved ? (
                  <Check className="w-3 h-3" />
                ) : null}
                save
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm whitespace-pre-wrap">
          {existing?.relationship_notes}
        </p>
      )}
    </div>
  );
}

// ===== Admin: Soul (system_prompt) editor =====
function SoulEditor({
  agentId,
  initial,
}: {
  agentId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(initial), [initial]);
  const dirty = value !== initial;

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agents")
        .update({ system_prompt: value, updated_at: new Date().toISOString() })
        .eq("id", agentId);
      if (error) throw error;
      toast.success("Soul saved");
    } catch (e) {
      toast.error("Couldn't save soul", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-3 rounded-lg bg-card border border-primary/30 space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={12}
        className="w-full bg-background border border-border rounded-md p-2 text-xs font-mono focus:outline-none focus:border-primary/60 resize-y leading-relaxed"
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="text-[11px] font-mono uppercase tracking-widest px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          save soul
        </button>
      </div>
    </div>
  );
}

// ===== Admin: edit modal for memory =====
function MemoryEditModal({
  memory,
  onClose,
  onSaved,
}: {
  memory: MemoryRow;
  onClose: () => void;
  onSaved: (m: MemoryRow) => void;
}) {
  const [title, setTitle] = useState(memory.title ?? "");
  const [content, setContent] = useState(memory.content ?? "");
  const [tags, setTags] = useState((memory.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const tagArr = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const { data, error } = await supabase
        .from("memories")
        .update({ title: title.trim() || null, content, tags: tagArr })
        .eq("id", memory.id)
        .select("id, title, content, tags, created_at, metadata")
        .single();
      if (error) throw error;
      toast.success("Memory saved");
      onSaved(data as MemoryRow);
      onClose();
    } catch (e) {
      toast.error("Couldn't save memory", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
            edit memory
          </p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="title (optional)"
          className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60 resize-y"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="comma, separated, tags"
          className="w-full bg-background border border-border rounded-md p-2 text-xs font-mono focus:outline-none focus:border-primary/60"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground px-3 py-1"
          >
            cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-[11px] font-mono uppercase tracking-widest px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 flex items-center gap-1"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            save
          </button>
        </div>
      </div>
    </div>
  );
}

type ProfileDetail = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  profile_picture_url: string | null;
  telegram_photo_url: string | null;
  telegram_username: string | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
  source_url: string | null;
  headline: string | null;
  bio: string | null;
  intentions?: string | null;
  interests_skills?: string[] | null;
  email?: string | null;
  vibecoin_balance?: number | null;
  world_id_verified?: boolean | null;
};

function ProfileDetailModal({
  profile,
  onClose,
}: {
  profile: ProfileDetail;
  onClose: () => void;
}) {
  const avatar =
    profile.avatar_url ??
    profile.profile_picture_url ??
    profile.telegram_photo_url ??
    null;
  const display = profile.name ?? (profile.telegram_username ? `@${profile.telegram_username}` : "—");
  const initial = (display ?? "?").slice(0, 1).toUpperCase();

  const stripAt = (h: string) => h.replace(/^@/, "");
  const links: { label: string; href: string }[] = [];
  if (profile.telegram_username)
    links.push({ label: `telegram · @${stripAt(profile.telegram_username)}`, href: `https://t.me/${stripAt(profile.telegram_username)}` });
  if (profile.instagram_handle)
    links.push({ label: `instagram · @${stripAt(profile.instagram_handle)}`, href: `https://instagram.com/${stripAt(profile.instagram_handle)}` });
  if (profile.twitter_handle)
    links.push({ label: `x · @${stripAt(profile.twitter_handle)}`, href: `https://x.com/${stripAt(profile.twitter_handle)}` });
  if (profile.source_url) links.push({ label: profile.source_url.replace(/^https?:\/\//, ""), href: profile.source_url });

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-lg p-4 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0 ring-1 ring-border">
              {avatar ? (
                <img src={avatar} alt={display} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-mono text-muted-foreground">
                  {initial}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold truncate">{display}</p>
              {profile.telegram_username && profile.name && (
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  @{stripAt(profile.telegram_username)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {profile.headline && (
          <p className="text-sm text-foreground/90 [overflow-wrap:anywhere]">{profile.headline}</p>
        )}

        {profile.bio && (
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">bio</p>
            <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere] text-foreground/90">{profile.bio}</p>
          </div>
        )}

        {profile.intentions && (
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">intentions</p>
            <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere] text-foreground/90">{profile.intentions}</p>
          </div>
        )}

        {profile.interests_skills && profile.interests_skills.length > 0 && (
          <div className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">interests & skills</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.interests_skills.map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {links.length > 0 && (
          <div className="space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">links</p>
            <div className="flex flex-col gap-1.5">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline underline-offset-2 break-all"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {(profile.email || profile.vibecoin_balance != null || profile.world_id_verified) && (
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
            {profile.email && (
              <div className="col-span-2 min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">email</p>
                <p className="text-xs font-mono break-all">{profile.email}</p>
              </div>
            )}
            {profile.vibecoin_balance != null && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">vibecoin</p>
                <p className="text-xs font-mono">{profile.vibecoin_balance}</p>
              </div>
            )}
            {profile.world_id_verified && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">world id</p>
                <p className="text-xs">verified ✓</p>
              </div>
            )}
          </div>
        )}

        {!profile.headline && !profile.bio && !profile.intentions && links.length === 0 && (!profile.interests_skills || profile.interests_skills.length === 0) && (
          <p className="text-xs text-muted-foreground italic">no profile details yet.</p>
        )}
      </div>
    </div>
  );
}

type MeButtonProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  telegram_photo_url: string | null;
  telegram_username: string | null;
  headline: string | null;
  bio: string | null;
  email: string | null;
  auth_user_id?: string | null;
  username?: string | null;
  profile_picture_url?: string | null;
  created_at?: string | null;
};

function MeButton({
  profile,
  fallbackName,
  onViewFull,
}: {
  profile: MeButtonProfile | null;
  fallbackName: string | null;
  onViewFull?: () => void;
}) {
  const name = profile?.name ?? fallbackName ?? "You";
  const handle = profile?.telegram_username ?? null;
  const photo = profile?.avatar_url ?? profile?.telegram_photo_url ?? undefined;
  const initials = (name || "?")
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      aria-label="Your profile"
      onClick={onViewFull}
      className="rounded-full ring-1 ring-primary/40 hover:ring-primary transition-shadow"
    >
      <Avatar className="w-8 h-8">
        {photo && <AvatarImage src={photo} alt={name} />}
        <AvatarFallback className="text-[10px] font-mono">{initials}</AvatarFallback>
      </Avatar>
    </button>
  );
}

export default function TelegramMini() {
  const { agent } = useVibeyAgent();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [tgName, setTgName] = useState<string | null>(null);
  const [tgUserId, setTgUserId] = useState<number | null>(null);

  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [memLoading, setMemLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [prefs, setPrefs] = useState<PreferenceRow[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [memFilter, setMemFilter] = useState<"all" | "mine" | "others">("all");
  const [isMember, setIsMember] = useState(false);

  // Memory composer (member-only)
  const [memComposerOpen, setMemComposerOpen] = useState(false);
  const [newMemTitle, setNewMemTitle] = useState("");
  const [newMemContent, setNewMemContent] = useState("");
  const [savingMem, setSavingMem] = useState(false);

  // Event composer (member-only)
  const [eventComposerOpen, setEventComposerOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");
  const [newEventImageUrl, setNewEventImageUrl] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryRow | null>(null);
  const [allPrefs, setAllPrefs] = useState<PreferenceRow[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLogRow[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Tabs
  type Tab = "memories" | "profiles" | "preferences" | "events" | "soul";
  const [tab, setTab] = useState<Tab>("memories");

  // Profiles directory
  type DirectoryEntry = {
    id: string;
    auth_user_id: string | null;
    name: string | null;
    avatar_url: string | null;
    profile_picture_url: string | null;
    telegram_photo_url: string | null;
    telegram_username: string | null;
    instagram_handle: string | null;
    twitter_handle: string | null;
    source_url: string | null;
    headline: string | null;
    bio: string | null;
    intentions: string | null;
    interests_skills: string[] | null;
  };
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<ProfileDetail | null>(null);
  const [directoryQuery, setDirectoryQuery] = useState("");

  // Current user mini-profile (for header avatar popover)
  const [myProfile, setMyProfile] = useState<MiniProfile | null>(null);

  const filteredDirectory = useMemo(() => {
    const q = directoryQuery.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter((u) =>
      [u.name, u.telegram_username, u.headline, u.bio]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [directory, directoryQuery]);

  // 1. Telegram WebApp + auth (with preview/mock fallback)
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const params = new URLSearchParams(window.location.search);
    const isPreviewHost =
      window.location.hostname.includes("lovable.app") &&
      window.location.hostname.includes("preview");
    const mockMode =
      params.get("mock") === "1" ||
      (!tg && (isPreviewHost || window.location.hostname === "localhost"));

    if (!tg && !mockMode) {
      setAuthState("error");
      setAuthError("Open this page from inside Telegram (or add ?mock=1 to preview).");
      return;
    }

    if (tg) {
      tg.ready();
      tg.expand();
      setTgName(tg.initDataUnsafe?.user?.first_name ?? null);
      setTgUserId(tg.initDataUnsafe?.user?.id ?? null);
    }

    const initData = tg?.initData;

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let miniAuthUserId: string | null = null;
        let miniPublicUserId: string | null = null;

        if (mockMode) {
          // Preview mode: rely on an existing Supabase session (admin login).
          if (!sessionData.session) {
            throw new Error(
              "Preview mode needs a Supabase session. Sign in at /login first, then return here.",
            );
          }
          const u = sessionData.session.user;
          miniAuthUserId = u.id;

          const { data: previewRows, error: previewErr } = await supabase
            .from("users")
            .select("id, auth_user_id, name, username, avatar_url, profile_picture_url, telegram_photo_url, telegram_user_id, telegram_username, headline, bio, email, created_at")
            .eq("auth_user_id", u.id)
            .limit(20);
          if (previewErr) throw previewErr;

          const previewProfile = pickBestProfile(previewRows as MiniProfile[] | null);
          if (previewProfile) {
            miniPublicUserId = previewProfile.id;
            setMyProfile(previewProfile);
            setTgName(
              previewProfile.name ??
                previewProfile.username ??
                (u.user_metadata?.name as string) ??
                u.email?.split("@")[0] ??
                "Preview",
            );
            if (previewProfile.telegram_user_id != null) {
              setTgUserId(previewProfile.telegram_user_id);
            }
          } else {
            setTgName(
              (u.user_metadata?.name as string) ??
                u.email?.split("@")[0] ??
                "Preview",
            );
          }

          if (previewProfile?.telegram_user_id == null) {
            // Keep local-only preview features usable for profiles that have not
            // linked Telegram yet; real Telegram auth always replaces this.
            let hash = 0;
            for (const ch of u.id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
            setTgUserId(Math.abs(hash) || 1);
          }
        } else {
          if (!initData) throw new Error("No Telegram initData — try reopening the mini app.");
          const { data, error } = await supabase.functions.invoke(
            "telegram-mini-auth",
            { body: { initData } },
          );
          if (error) throw error;
          if (!data?.token_hash || !data?.email) throw new Error("no token");
          miniAuthUserId = data.auth_user_id ?? null;
          miniPublicUserId = data.public_user_id ?? null;
          const currentUserId = sessionData.session?.user?.id ?? null;

          // Telegram is the source of truth inside the mini app. Reconcile even
          // when the WebView has a cached session, otherwise RLS can point at an
          // old synthetic Telegram account and hide the real Jack profile data.
          if (!currentUserId || !miniAuthUserId || currentUserId !== miniAuthUserId) {
            if (currentUserId) await supabase.auth.signOut();
            const { error: verifyErr } = await supabase.auth.verifyOtp({
              token_hash: data.token_hash,
              type: "magiclink",
            });
            if (verifyErr) throw verifyErr;
          }
          if (data.user?.name) setTgName(data.user.name);
          if (data.user?.telegram_id) setTgUserId(data.user.telegram_id);
        }

        // Check admin status (server-side via SECURITY DEFINER function)
        const { data: adminCheck, error: adminErr } = await supabase.rpc(
          "is_community_admin",
          {
            community_id_param: VIBEY_COMMUNITY_ID,
            user_auth_id: (await supabase.auth.getUser()).data.user?.id,
          },
        );
        if (!adminErr && adminCheck === true) setIsAdmin(true);

        // Check community membership (gates the "add memory" composer)
        const authUid = (await supabase.auth.getUser()).data.user?.id;
        if (authUid) {
          let bestUser: { id: string } | null = null;
          if (miniPublicUserId) {
            const { data: linkedUser } = await supabase
              .from("users")
              .select("id")
              .eq("id", miniPublicUserId)
              .maybeSingle();
            bestUser = linkedUser;
          }
          if (!bestUser) {
            const { data: userRow } = await supabase
              .from("users")
              .select("id")
              .eq("auth_user_id", authUid)
              .limit(20);
            bestUser = pickBestProfile(userRow as Array<{ id: string }> | null);
          }
          if (bestUser?.id) {
            const { data: memberRow } = await supabase
              .from("community_members")
              .select("id")
              .eq("community_id", VIBEY_COMMUNITY_ID)
              .eq("user_id", bestUser.id)
              .maybeSingle();
            if (memberRow) setIsMember(true);
          }
        }

        setAuthState("ready");

        // Load current user mini-profile for the header avatar popover.
        try {
          const meAuthId = (await supabase.auth.getUser()).data.user?.id;
          if (meAuthId) {
            let best: MiniProfile | null = null;
            if (miniPublicUserId) {
              const { data: linkedProfile } = await supabase
                .from("users")
                .select(MINI_PROFILE_COLUMNS)
                .eq("id", miniPublicUserId)
                .maybeSingle();
              best = linkedProfile as MiniProfile | null;
            }
            if (!best) {
              const { data: meRow } = await supabase
                .from("users")
                .select(MINI_PROFILE_COLUMNS)
                .eq("auth_user_id", meAuthId)
                .limit(20);
              best = pickBestProfile(meRow as MiniProfile[] | null);
            }
            if (best) setMyProfile(best);
          }
        } catch (e) {
          console.warn("load my profile failed", e);
        }
      } catch (e) {
        console.error(e);
        setAuthError(e instanceof Error ? e.message : "Auth failed");
        setAuthState("error");
      }
    })();
  }, []);

  // 2. Memories + realtime
  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("id, title, content, tags, created_at, metadata")
        .eq("community_id", VIBEY_COMMUNITY_ID)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) console.error("load memories failed", error.message);
      else setMemories((data ?? []) as MemoryRow[]);
      setMemLoading(false);
    })();

    const channel = supabase
      .channel("mini-memories")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "memories",
          filter: `community_id=eq.${VIBEY_COMMUNITY_ID}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as MemoryRow;
            setMemories((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as MemoryRow;
            setMemories((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as MemoryRow;
            setMemories((prev) => prev.filter((m) => m.id !== row.id));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [authState]);

  // 3. Events
  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;
    (async () => {
      setEventsLoading(true);
      const now = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, event_start_time, event_end_time, event_location, event_type, event_image_url, hosted_by, is_featured, tags")
        .eq("community_id", VIBEY_COMMUNITY_ID)
        .gte("event_end_time", now)
        .order("event_start_time", { ascending: true })
        .limit(50);
      if (cancelled) return;
      if (error) {
        console.error("load events failed", error.message);
        setEvents([]);
      } else {
        setEvents((data ?? []) as EventRow[]);
      }
      setEventsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authState]);

  // 3. Personal preferences
  useEffect(() => {
    if (authState !== "ready" || !tgUserId) {
      setPrefsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vibey_relationships")
        .select("id, community_id, telegram_user_id, relationship_notes, display_name, updated_at")
        .in("community_id", PREFERENCE_COMMUNITY_IDS)
        .eq("telegram_user_id", tgUserId);
      if (cancelled) return;
      if (error) console.error("load prefs failed", error.message);
      else setPrefs((data ?? []) as PreferenceRow[]);
      setPrefsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authState, tgUserId]);
  // Profiles directory (community members joined with users) — Vibe Code Residency
  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;
    (async () => {
      setDirectoryLoading(true);
      const { data, error } = await supabase
        .from("community_members")
        .select(
          "user_id, users:users!community_members_user_id_fkey(id, auth_user_id, name, avatar_url, profile_picture_url, telegram_photo_url, telegram_username, instagram_handle, twitter_handle, source_url, headline, bio, intentions, interests_skills)",
        )
        .eq("community_id", VIBE_CODE_RESIDENCY_COMMUNITY_ID)
        .order("joined_at", { ascending: true })
        .limit(1000);
      if (cancelled) return;
      if (error) {
        console.error("load directory failed", error.message);
        setDirectory([]);
      } else {
        const raw = (data ?? [])
          .map((row: { users: DirectoryEntry | null }) => row.users)
          .filter((u): u is DirectoryEntry => !!u);

        // Dedupe by auth_user_id (when present) else by id. Prefer the row with the
        // most complete profile (avatar, headline, telegram_username).
        const score = (u: DirectoryEntry) =>
          (u.avatar_url || u.profile_picture_url || u.telegram_photo_url ? 4 : 0) +
          (u.telegram_username ? 2 : 0) +
          (u.headline ? 1 : 0) +
          (u.bio ? 1 : 0);
        const byKey = new Map<string, DirectoryEntry>();
        for (const u of raw) {
          const key = u.auth_user_id ?? u.id;
          const existing = byKey.get(key);
          if (!existing || score(u) > score(existing)) byKey.set(key, u);
        }
        const entries = Array.from(byKey.values()).sort((a, b) =>
          (a.name ?? "~").localeCompare(b.name ?? "~"),
        );
        setDirectory(entries);
      }
      setDirectoryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authState]);


  // 4. Admin data — load all prefs + chat logs when admin mode is on
  useEffect(() => {
    if (!adminMode || !isAdmin) return;
    let cancelled = false;
    setAdminLoading(true);
    (async () => {
      const [prefsRes, logsRes] = await Promise.all([
        supabase
          .from("vibey_relationships")
          .select("id, community_id, telegram_user_id, relationship_notes, display_name, updated_at")
          .eq("community_id", VIBEY_COMMUNITY_ID)
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase
          .from("agent_chat_logs")
          .select("id, user_message, agent_response, telegram_username, telegram_user_id, created_at, total_tokens, cost_credits, openrouter_model")
          .eq("community_id", VIBEY_COMMUNITY_ID)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;
      if (prefsRes.error) console.error("load all prefs", prefsRes.error.message);
      else setAllPrefs((prefsRes.data ?? []) as PreferenceRow[]);
      if (logsRes.error) console.error("load chat logs", logsRes.error.message);
      else setChatLogs((logsRes.data ?? []) as ChatLogRow[]);
      setAdminLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminMode, isAdmin]);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function savePreference(community_id: string, agent_id: string, notes: string) {
    if (!tgUserId) return;
    setSavingId(community_id);
    const existing = prefs.find((p) => p.community_id === community_id);
    const trimmed = notes.trim();
    try {
      if (existing) {
        const { data, error } = await supabase
          .from("vibey_relationships")
          .update({
            relationship_notes: trimmed.length ? trimmed : null,
            display_name: tgName ?? existing.display_name,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id, community_id, telegram_user_id, relationship_notes, display_name, updated_at")
          .single();
        if (error) throw error;
        setPrefs((prev) => prev.map((p) => (p.id === existing.id ? (data as PreferenceRow) : p)));
      } else {
        const { data, error } = await supabase
          .from("vibey_relationships")
          .insert({
            community_id,
            agent_id,
            telegram_user_id: tgUserId,
            display_name: tgName,
            relationship_notes: trimmed.length ? trimmed : null,
          })
          .select("id, community_id, telegram_user_id, relationship_notes, display_name, updated_at")
          .single();
        if (error) throw error;
        setPrefs((prev) => [...prev, data as PreferenceRow]);
      }
      setSavedId(community_id);
      setTimeout(() => setSavedId((v) => (v === community_id ? null : v)), 1500);
      toast.success("Preferences saved");
    } catch (e) {
      console.error("save preference failed", e);
      toast.error("Couldn't save preferences", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSavingId(null);
    }
  }

  async function deleteMemory(m: MemoryRow) {
    if (!confirm("delete this memory? this can't be undone.")) return;
    const { error } = await supabase.from("memories").delete().eq("id", m.id);
    if (error) {
      toast.error("Couldn't delete memory", { description: error.message });
      return;
    }
    toast.success("Memory deleted");
    setMemories((prev) => prev.filter((x) => x.id !== m.id));
  }

  async function addMemory() {
    if (!newMemContent.trim()) return;
    setSavingMem(true);
    const metadata: Record<string, string | number> = { source: "telegram_mini" };
    if (tgUserId != null) metadata.telegram_user_id = tgUserId;
    if (tgName) metadata.telegram_username = tgName;
    const { data, error } = await supabase
      .from("memories")
      .insert({
        community_id: VIBEY_COMMUNITY_ID,
        title: newMemTitle.trim() || null,
        content: newMemContent.trim(),
        metadata,
      })
      .select("id, title, content, tags, created_at, metadata")
      .single();
    setSavingMem(false);
    if (error) {
      toast.error("Couldn't save memory", { description: error.message });
      return;
    }
    setMemories((prev) =>
      prev.some((m) => m.id === (data as MemoryRow).id) ? prev : [data as MemoryRow, ...prev],
    );
    setNewMemTitle("");
    setNewMemContent("");
    setMemComposerOpen(false);
    toast.success("memory saved");
  }

  async function addEvent() {
    if (!newEventTitle.trim() || !newEventStart.trim()) return;
    if (!myProfile?.id) {
      toast.error("Couldn't create event", { description: "Your profile is still loading." });
      return;
    }

    const start = new Date(newEventStart);
    const end = newEventEnd.trim()
      ? new Date(newEventEnd)
      : new Date(start.getTime() + 60 * 60 * 1000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error("Couldn't create event", { description: "Please add a valid date and time." });
      return;
    }
    if (end <= start) {
      toast.error("Couldn't create event", { description: "End time needs to be after start time." });
      return;
    }

    setSavingEvent(true);
    const { data, error } = await supabase
      .from("events")
      .insert({
        community_id: VIBEY_COMMUNITY_ID,
        created_by: myProfile.id,
        title: newEventTitle.trim(),
        description: newEventDescription.trim() || null,
        event_location: newEventLocation.trim() || null,
        event_image_url: newEventImageUrl.trim() || null,
        event_start_time: start.toISOString(),
        event_end_time: end.toISOString(),
        event_status: "published",
        event_type: "virtual",
        hosted_by: myProfile.name ?? myProfile.username ?? tgName ?? "Vibey community",
        is_public: true,
        registration_required: false,
        tags: ["vibey"],
        metadata: { source: "telegram_mini" },
      })
      .select("id, title, description, event_start_time, event_end_time, event_location, event_type, event_image_url, hosted_by, is_featured, tags")
      .single();
    setSavingEvent(false);
    if (error) {
      toast.error("Couldn't create event", { description: error.message });
      return;
    }
    setEvents((prev) =>
      [...prev, data as EventRow].sort(
        (a, b) => new Date(a.event_start_time).getTime() - new Date(b.event_start_time).getTime(),
      ),
    );
    setNewEventTitle("");
    setNewEventDescription("");
    setNewEventLocation("");
    setNewEventStart("");
    setNewEventEnd("");
    setNewEventImageUrl("");
    setEventComposerOpen(false);
    toast.success("event added");
  }

  const isMine = (m: MemoryRow) =>
    tgUserId != null &&
    Number((m.metadata as Record<string, unknown> | null)?.telegram_user_id) === tgUserId;

  const filteredMemories = useMemo(() => {
    if (memFilter === "mine") return memories.filter(isMine);
    if (memFilter === "others") return memories.filter((m) => !isMine(m));
    return memories;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories, memFilter, tgUserId]);

  const adminUsage = useMemo(() => {
    return chatLogs.reduce(
      (acc, row) => {
        acc.tokens += row.total_tokens ?? 0;
        acc.cost += Number(row.cost_credits ?? 0);
        return acc;
      },
      { tokens: 0, cost: 0 },
    );
  }, [chatLogs]);

  // ===== Render =====
  if (authState === "loading") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          connecting to vibey
        </p>
      </div>
    );
  }

  if (authState === "error") {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground p-6 text-center">
        <p className="text-sm">{authError ?? "Couldn't sign you in."}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          telegram mini app · vibey
        </p>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: typeof Brain }[] = [
    { id: "memories", label: "memories", icon: Brain },
    { id: "profiles", label: "profiles", icon: UsersIcon },
    { id: "preferences", label: "you", icon: Heart },
    { id: "events", label: "events", icon: Calendar },
    { id: "soul", label: "soul", icon: Sparkles },
  ];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-primary/30">
          <img src={vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">
            {agent?.name ?? "Vibey"}'s Brain
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {memLoading ? "loading…" : `${memories.length} memories${tgName ? ` · hi, ${tgName}` : ""}`}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setAdminMode((v) => !v)}
            aria-label={adminMode ? "Exit admin mode" : "Enter admin mode"}
            className={
              "flex items-center gap-1 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-widest border transition-colors " +
              (adminMode
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:text-primary hover:border-primary/40")
            }
          >
            <Shield className="w-3 h-3" />
            admin
          </button>
        )}
        <MeButton
          profile={myProfile}
          fallbackName={tgName}
          onViewFull={() => {
            if (!myProfile) return;
            setSelectedProfile({
              id: myProfile.id,
              name: myProfile.name,
              avatar_url: myProfile.avatar_url,
              profile_picture_url: myProfile.profile_picture_url ?? null,
              telegram_photo_url: myProfile.telegram_photo_url,
              telegram_username: myProfile.telegram_username,
              instagram_handle: myProfile.instagram_handle ?? null,
              twitter_handle: myProfile.twitter_handle ?? null,
              source_url: myProfile.source_url ?? null,
              headline: myProfile.headline,
              bio: myProfile.bio,
              intentions: myProfile.intentions ?? null,
              interests_skills: myProfile.interests_skills ?? null,
              email: myProfile.email,
              vibecoin_balance: myProfile.vibecoin_balance ?? null,
              world_id_verified: myProfile.world_id_verified ?? null,
            });
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border bg-card/40 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-widest transition-colors whitespace-nowrap " +
                (active
                  ? "bg-primary/15 text-primary border border-primary/40"
                  : "text-muted-foreground hover:text-foreground border border-transparent")
              }
            >
              <Icon className="w-3 h-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-5">
        {/* ===== MEMORIES TAB ===== */}
        {tab === "memories" && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Brain className="w-3 h-3" />
                community memory · {memories.length}
              </h2>
              {isMember && !adminMode && (
                <button
                  onClick={() => setMemComposerOpen((o) => !o)}
                  className={
                    "px-2 py-1 rounded font-mono text-[10px] uppercase tracking-widest border transition-colors flex items-center gap-1 " +
                    (memComposerOpen
                      ? "bg-muted text-muted-foreground border-border"
                      : "bg-primary/15 text-primary border-primary/40 hover:bg-primary/20")
                  }
                >
                  {memComposerOpen ? (
                    <>
                      <X className="w-3 h-3" /> cancel
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" /> add
                    </>
                  )}
                </button>
              )}
            </div>

            {isMember && memComposerOpen && !adminMode && (
              <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                <input
                  value={newMemTitle}
                  onChange={(e) => setNewMemTitle(e.target.value)}
                  placeholder="title (optional, short headline)"
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
                />
                <textarea
                  value={newMemContent}
                  onChange={(e) => setNewMemContent(e.target.value)}
                  rows={3}
                  placeholder="what should vibey remember?"
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60 resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] text-muted-foreground">
                    saved as {tgName ?? "you"}
                  </p>
                  <button
                    onClick={addMemory}
                    disabled={savingMem || !newMemContent.trim()}
                    className="text-[11px] font-mono uppercase tracking-widest px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 flex items-center gap-1"
                  >
                    {savingMem && <Loader2 className="w-3 h-3 animate-spin" />}
                    save
                  </button>
                </div>
              </div>
            )}

            {memLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : memories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Brain className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">no memories yet</p>
              </div>
            ) : adminMode ? (
              <AnimatePresence initial={false}>
                {memories.map((m) => (
                  <MemoryCard
                    key={m.id}
                    m={m}
                    adminMode
                    onEdit={setEditingMemory}
                    onDelete={deleteMemory}
                  />
                ))}
              </AnimatePresence>
            ) : (
              <>
                <div className="flex items-center gap-1 flex-wrap">
                  <Filter className="w-3 h-3 text-muted-foreground" />
                  {(["all", "mine", "others"] as const).map((key) => {
                    const count =
                      key === "mine"
                        ? memories.filter(isMine).length
                        : key === "others"
                          ? memories.filter((m) => !isMine(m)).length
                          : memories.length;
                    if (key === "mine" && tgUserId == null) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => setMemFilter(key)}
                        className={
                          "px-2 py-1 rounded font-mono text-[10px] uppercase tracking-widest transition-colors " +
                          (memFilter === key
                            ? "bg-primary/15 text-primary border border-primary/40"
                            : "bg-muted text-muted-foreground border border-transparent hover:text-foreground")
                        }
                      >
                        {key} · {count}
                      </button>
                    );
                  })}
                </div>
                {filteredMemories.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">
                    nothing here yet for this filter.
                  </p>
                ) : (
                  <AnimatePresence initial={false}>
                    {filteredMemories.map((m) => (
                      <MemoryCard key={m.id} m={m} highlight={isMine(m)} />
                    ))}
                  </AnimatePresence>
                )}
              </>
            )}
          </section>
        )}

        {/* ===== PREFERENCES (YOU) TAB ===== */}
        {tab === "preferences" && (
          <section className="space-y-3">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Heart className="w-3 h-3" />
              your preferences
            </h2>
            <p className="text-[11px] text-muted-foreground px-0.5 leading-relaxed">
              tell vibey how you want to be talked to. tone, length, nicknames, vibe.
            </p>
            {prefsLoading || !tgUserId ? (
              <div className="flex items-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              PREFERENCE_COMMUNITIES.map((c) => (
                <PreferenceEditor
                  key={c.community_id}
                  community_id={c.community_id}
                  agent_id={c.agent_id}
                  label={c.label}
                  existing={prefs.find((p) => p.community_id === c.community_id) ?? null}
                  saving={savingId === c.community_id}
                  saved={savedId === c.community_id}
                  onSave={(notes) => savePreference(c.community_id, c.agent_id, notes)}
                />
              ))
            )}
          </section>
        )}

        {/* ===== PROFILES TAB ===== */}
        {tab === "profiles" && (
          <>
            {/* Directory */}
            <section className="space-y-2">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <UsersIcon className="w-3 h-3" />
                community · {directoryQuery ? `${filteredDirectory.length} / ${directory.length}` : directory.length}
              </h2>
              <input
                value={directoryQuery}
                onChange={(e) => setDirectoryQuery(e.target.value)}
                placeholder="search name, @handle, headline…"
                className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
              />
              {directoryLoading ? (
                <div className="flex items-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : directory.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">no profiles loaded.</p>
              ) : filteredDirectory.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">no matches.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredDirectory.map((u) => {
                    const avatar =
                      u.avatar_url ??
                      u.profile_picture_url ??
                      u.telegram_photo_url ??
                      null;
                    const display = u.name ?? (u.telegram_username ? `@${u.telegram_username}` : "—");
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setSelectedProfile(u)}
                        className="p-2.5 rounded-lg bg-card border border-border flex items-center gap-2 min-w-0 text-left hover:border-primary/40 hover:bg-muted/40 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-muted shrink-0 ring-1 ring-border">
                          {avatar ? (
                            <img src={avatar} alt={display} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-mono text-muted-foreground">
                              {(display ?? "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{display}</p>
                          {u.headline && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {u.headline}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Admin: everyone's preferences + chat history */}
            {adminMode && isAdmin && (
              <>
                <section className="space-y-2 pt-2">
                  <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Heart className="w-3 h-3" />
                    everyone's preferences · {allPrefs.length}
                  </h2>
                  {adminLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : allPrefs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">no preferences set yet.</p>
                  ) : (
                    allPrefs.map((p) => (
                      <div key={p.id} className="p-3 rounded-lg bg-card border border-border">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-semibold">
                            {p.display_name ?? `tg ${p.telegram_user_id ?? "?"}`}
                          </p>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {p.updated_at
                              ? formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })
                              : ""}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap text-foreground/90">
                          {p.relationship_notes ?? (
                            <span className="text-muted-foreground italic">— empty —</span>
                          )}
                        </p>
                      </div>
                    ))
                  )}
                </section>

                <section className="space-y-2 pt-2">
                  <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" />
                    recent conversations · {chatLogs.length}
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-card border border-border">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        tokens
                      </p>
                      <p className="font-mono text-lg font-semibold mt-1">
                        {formatTokens(adminUsage.tokens)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        OpenRouter
                      </p>
                      <p className="font-mono text-lg font-semibold mt-1">
                        {formatCredits(adminUsage.cost)}
                      </p>
                    </div>
                  </div>
                  {adminLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : chatLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">no chat logs yet.</p>
                  ) : (
                    chatLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded-lg bg-card border border-border space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {log.telegram_username ? `@${log.telegram_username}` : `tg ${log.telegram_user_id ?? "?"}`}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {(log.total_tokens || log.cost_credits || log.openrouter_model) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {log.total_tokens ? (
                              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                <Zap className="w-2.5 h-2.5" />
                                {formatTokens(log.total_tokens)} tok
                              </span>
                            ) : null}
                            {log.cost_credits ? (
                              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                <Coins className="w-2.5 h-2.5" />
                                {formatCredits(Number(log.cost_credits))}
                              </span>
                            ) : null}
                            {log.openrouter_model ? (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground truncate max-w-full">
                                {log.openrouter_model}
                              </span>
                            ) : null}
                          </div>
                        )}
                        <div className="text-xs">
                          <p className="text-muted-foreground font-mono text-[10px] uppercase mb-0.5">user</p>
                          <p className="whitespace-pre-wrap">{log.user_message}</p>
                        </div>
                        <div className="text-xs">
                          <p className="text-primary font-mono text-[10px] uppercase mb-0.5">vibey</p>
                          <p className="whitespace-pre-wrap">{log.agent_response}</p>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </>
            )}
          </>
        )}

        {/* ===== EVENTS TAB ===== */}
        {tab === "events" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                upcoming events · {events.length}
              </h2>
              {isMember && (
                <button
                  type="button"
                  onClick={() => setEventComposerOpen((open) => !open)}
                  className="h-8 px-2.5 rounded-md bg-primary/10 border border-primary/30 text-primary font-mono text-[10px] uppercase tracking-widest flex items-center gap-1.5"
                >
                  {eventComposerOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {eventComposerOpen ? "close" : "new"}
                </button>
              )}
            </div>

            {eventComposerOpen && isMember && (
              <div className="p-3 rounded-lg bg-card border border-primary/25 space-y-2">
                <input
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="event title"
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
                />
                <textarea
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  placeholder="short description"
                  rows={3}
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60 resize-none"
                />
                <input
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  placeholder="location or link"
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
                />
                <div className="space-y-1.5">
                  <input
                    value={newEventImageUrl}
                    onChange={(e) => setNewEventImageUrl(e.target.value)}
                    placeholder="cover image url (optional)"
                    className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
                  />
                  {newEventImageUrl.trim() && (
                    <div className="rounded-md overflow-hidden border border-border aspect-[16/9] bg-muted">
                      <img
                        src={newEventImageUrl.trim()}
                        alt="cover preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">starts</span>
                    <input
                      type="datetime-local"
                      value={newEventStart}
                      onChange={(e) => setNewEventStart(e.target.value)}
                      className="w-full bg-background border border-border rounded-md p-2 text-xs focus:outline-none focus:border-primary/60"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">ends</span>
                    <input
                      type="datetime-local"
                      value={newEventEnd}
                      onChange={(e) => setNewEventEnd(e.target.value)}
                      className="w-full bg-background border border-border rounded-md p-2 text-xs focus:outline-none focus:border-primary/60"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addEvent}
                  disabled={savingEvent || !newEventTitle.trim() || !newEventStart.trim()}
                  className="w-full h-9 rounded-md bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingEvent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
                  add event
                </button>
              </div>
            )}

            {eventsLoading ? (
              <div className="flex items-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">no events yet</p>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  community calls, workshops, dinners, and pop-ups will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => {
                  const start = new Date(event.event_start_time);
                  const end = new Date(event.event_end_time);
                  const sameDay = start.toDateString() === end.toDateString();
                  return (
                    <article
                      key={event.id}
                      className="rounded-lg bg-card border border-border overflow-hidden"
                    >
                      {event.event_image_url && (
                        <div className="aspect-[16/9] bg-muted overflow-hidden">
                          <img
                            src={event.event_image_url}
                            alt={event.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug">{event.title}</p>
                          <p className="font-mono text-[10px] uppercase tracking-widest text-primary mt-1">
                            {format(start, "EEE, MMM d")} · {format(start, "h:mm a")}
                            {" - "}
                            {sameDay ? format(end, "h:mm a") : format(end, "EEE h:mm a")}
                          </p>
                        </div>
                        {event.is_featured && (
                          <span className="shrink-0 rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                            featured
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {event.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {event.event_location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.event_location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(start, { addSuffix: true })}
                        </span>
                      </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ===== SOUL TAB ===== */}
        {tab === "soul" && (
          <section className="space-y-2">
            <h2
              className={
                "font-mono text-[10px] uppercase tracking-widest flex items-center gap-1.5 " +
                (adminMode ? "text-primary" : "text-muted-foreground")
              }
            >
              <Sparkles className="w-3 h-3" />
              vibey's soul · system prompt
            </h2>
            {adminMode && isAdmin && agent?.id && agent?.system_prompt != null ? (
              <SoulEditor agentId={agent.id} initial={agent.system_prompt} />
            ) : agent?.system_prompt ? (
              <div className="p-3 rounded-lg bg-card border border-border">
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-foreground/90">
                  {agent.system_prompt}
                </pre>
                <p className="text-[10px] text-muted-foreground font-mono mt-3">
                  read-only · this is the bones of who vibey is
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4">no soul yet.</p>
            )}
          </section>
        )}
      </div>

      {editingMemory && (
        <MemoryEditModal
          memory={editingMemory}
          onClose={() => setEditingMemory(null)}
          onSaved={(m) => setMemories((prev) => prev.map((x) => (x.id === m.id ? m : x)))}
        />
      )}

      {selectedProfile && (
        <ProfileDetailModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </div>
  );
}
