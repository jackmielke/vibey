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
  ImagePlus,
  Camera,
  MessagesSquare,
  GraduationCap,
  Rocket,
  ExternalLink,
} from "lucide-react";
import { ConversationsSection } from "@/components/sections/ConversationsSection";
import { GalleryTab } from "@/components/sections/GalleryTab";
import { Image as ImageIcon } from "lucide-react";
import { BracketSection } from "@/components/sections/BracketSection";
import { Trophy } from "lucide-react";
import { EventEditModal, type EventEditRow } from "@/components/EventEditModal";
import { VibeyPortal } from "@/components/VibeyPortal";
import { HeartbeatToggles } from "@/components/HeartbeatToggles";
import { formatMemoryForTelegram, buildTelegramShareUrl } from "@/lib/shareMemory";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import { VIBEY_COMMUNITY_ID, VIBE_CODE_RESIDENCY_COMMUNITY_ID, DIRECTORY_COMMUNITY_IDS } from "@/lib/vibey";
import { toast } from "sonner";
import vibeyAvatar from "@/assets/vibey-avatar.png";
// (popover no longer used in this file)
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
  created_by: string;
  created_at: string;
  updated_at: string;
  current_attendees: number | null;
  max_attendees: number | null;
  is_public: boolean | null;
  registration_required: boolean | null;
};

const EVENT_SELECT =
  "id, title, description, event_start_time, event_end_time, event_location, event_type, event_image_url, hosted_by, is_featured, tags, created_by, created_at, updated_at, current_attendees, max_attendees, is_public, registration_required";

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  tags: string[] | null;
  is_featured: boolean | null;
  community_id: string;
  created_by: string | null;
  created_at: string;
  author?: { id: string; name: string | null; telegram_username: string | null; avatar_url: string | null } | null;
};

const PROJECT_SELECT =
  "id, title, description, url, image_url, tags, is_featured, community_id, created_by, created_at, author:users!projects_created_by_fkey(id, name, telegram_username, avatar_url)";

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
        initDataUnsafe?: { user?: { id?: number; first_name?: string }; start_param?: string };
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

type MemoryAuthor = {
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function authorInitials(a: MemoryAuthor | null): string {
  const src = a?.name || a?.username || "";
  if (!src) return "V";
  const parts = src.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || src[0]!.toUpperCase();
}

function MemoryCard({
  m,
  author,
  isMine,
  canEdit,
  onEdit,
  onDelete,
}: {
  m: MemoryRow;
  author?: MemoryAuthor | null;
  isMine?: boolean;
  canEdit?: boolean;
  onEdit?: (m: MemoryRow) => void;
  onDelete?: (m: MemoryRow) => void;
}) {
  const source = memorySource(m.metadata);
  const displayName = author?.name || (author?.username ? `@${author.username}` : "vibey");
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-3 rounded-lg bg-card border border-border overflow-hidden"
    >
      <div className="flex items-start gap-3 min-w-0">
        <Avatar className={"w-9 h-9 shrink-0 " + (isMine ? "ring-2 ring-primary" : "ring-1 ring-border")}>
          {author?.avatar_url ? (
            <AvatarImage src={author.avatar_url} alt={displayName} />
          ) : null}
          <AvatarFallback className="text-[10px] font-mono bg-muted">
            {authorInitials(author ?? null)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
              <span className="text-xs font-semibold truncate">{displayName}</span>
              {isMine && (
                <span className="text-[9px] font-mono uppercase tracking-widest text-primary px-1.5 py-0.5 rounded-sm bg-primary/10 border border-primary/30">
                  you
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canEdit && onEdit && (
                <button
                  onClick={() => onEdit(m)}
                  className="text-muted-foreground hover:text-primary p-1"
                  aria-label="Edit memory"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canEdit && onDelete && (
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
          {m.title && (
            <p className="text-sm font-semibold mt-1 break-words [overflow-wrap:anywhere]">
              {m.title}
            </p>
          )}
          <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere] mt-1 text-muted-foreground">
            {m.content ? renderWithLinks(m.content) : null}
          </p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-mono">
              {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
            </span>
            {source && !author?.username && (
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
        </div>
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
  const [memoryAuthors, setMemoryAuthors] = useState<Record<string, MemoryAuthor>>({});
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
  const [uploadingEventImage, setUploadingEventImage] = useState(false);
  const [uploadingProjectImage, setUploadingProjectImage] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryRow | null>(null);
  const [allPrefs, setAllPrefs] = useState<PreferenceRow[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLogRow[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Tabs
  type Tab = "memories" | "profiles" | "preferences" | "events" | "projects" | "gallery" | "workshops" | "soul" | "chats" | "bracket";
  const [tab, setTab] = useState<Tab>("memories");

  // Projects portfolio
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectComposerOpen, setProjectComposerOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectUrl, setNewProjectUrl] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectTags, setNewProjectTags] = useState("");
  const [newProjectImageUrl, setNewProjectImageUrl] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  // Workshops (admin only — Local Business AI Series)
  type WorkshopRow = { week: number; slug: string; title: string; subtitle: string | null; date_label: string | null; starts_at: string | null; tool: string | null; capacity: number; sort_order: number };
  type WorkshopInquiry = { id: string; name: string; email: string; phone: string | null; business: string | null; workshop_weeks: number[] | null; status: string; sms_opt_in: boolean | null; message: string | null; created_at: string; notes: string | null };
  type SurveyRow = { id: string; business_name: string | null; contact_name: string | null; contact_email: string | null; payload: Record<string, unknown> | null; created_at: string };
  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [workshopInquiries, setWorkshopInquiries] = useState<WorkshopInquiry[]>([]);
  const [workshopSurveys, setWorkshopSurveys] = useState<SurveyRow[]>([]);
  const [workshopsLoading, setWorkshopsLoading] = useState(false);
  const [workshopsError, setWorkshopsError] = useState<string | null>(null);
  const [workshopsLoaded, setWorkshopsLoaded] = useState(false);

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
    is_claimed: boolean | null;
    is_vibe_resident: boolean | null;
  };
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<ProfileDetail | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventEditRow | null>(null);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [showEmptyProfiles, setShowEmptyProfiles] = useState(false);

  // Current user mini-profile (for header avatar popover)
  const [myProfile, setMyProfile] = useState<MiniProfile | null>(null);

  const hasProfileContent = (u: DirectoryEntry) =>
    !!(u.bio || u.headline || u.intentions || (u.interests_skills?.length ?? 0) > 0);

  const filteredDirectory = useMemo(() => {
    const q = directoryQuery.trim().toLowerCase();
    const base = showEmptyProfiles ? directory : directory.filter(hasProfileContent);
    if (!q) return base;
    return base.filter((u) =>
      [u.name, u.telegram_username, u.headline, u.bio, u.intentions, (u.interests_skills ?? []).join(" ")]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [directory, directoryQuery, showEmptyProfiles]);


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

  // 2b. Resolve memory authors (by telegram_user_id / telegram_username)
  useEffect(() => {
    if (!memories.length) return;
    const tgIds = new Set<number>();
    const tgUsernames = new Set<string>();
    for (const m of memories) {
      const meta = (m.metadata ?? {}) as Record<string, unknown>;
      const tid = meta.telegram_user_id;
      const tuser = meta.telegram_username;
      const tidKey = typeof tid === "number" ? `tgid:${tid}` : null;
      const tuKey = typeof tuser === "string" && tuser ? `tguser:${tuser.toLowerCase()}` : null;
      if (typeof tid === "number" && !memoryAuthors[tidKey!]) tgIds.add(tid);
      if (typeof tuser === "string" && tuser && !memoryAuthors[tuKey!]) tgUsernames.add(tuser.toLowerCase());
    }
    if (!tgIds.size && !tgUsernames.size) return;
    let cancelled = false;
    (async () => {
      const cols = "id, name, username, telegram_username, telegram_user_id, telegram_photo_url, avatar_url, profile_picture_url";
      const next: Record<string, MemoryAuthor> = {};
      const toInfo = (row: Record<string, unknown>): MemoryAuthor => ({
        name: (row.name as string) ?? null,
        username: (row.telegram_username as string) ?? (row.username as string) ?? null,
        avatar_url:
          (row.telegram_photo_url as string) ??
          (row.profile_picture_url as string) ??
          (row.avatar_url as string) ??
          null,
      });
      if (tgIds.size) {
        const { data } = await supabase.from("users").select(cols).in("telegram_user_id", Array.from(tgIds));
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          next[`tgid:${row.telegram_user_id}`] = toInfo(row);
        }
      }
      if (tgUsernames.size) {
        const { data } = await supabase.from("users").select(cols).in("telegram_username", Array.from(tgUsernames));
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          const tu = row.telegram_username as string | null;
          if (tu) next[`tguser:${tu.toLowerCase()}`] = toInfo(row);
        }
      }
      if (!cancelled && Object.keys(next).length) {
        setMemoryAuthors((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories]);

  // 3. Events
  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;
    (async () => {
      setEventsLoading(true);
      const now = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
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

  // 3b. Projects portfolio
  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;
    (async () => {
      setProjectsLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .in("community_id", [VIBEY_COMMUNITY_ID, VIBE_CODE_RESIDENCY_COMMUNITY_ID])
        .eq("status", "active")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        console.error("load projects failed", error.message);
        setProjects([]);
      } else {
        setProjects((data ?? []) as ProjectRow[]);
      }
      setProjectsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authState]);



  // 2b. Workshops data (admin only, lazy-load when tab opens)
  useEffect(() => {
    if (tab !== "workshops" || !isAdmin || workshopsLoaded || workshopsLoading) return;
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData;
    if (!initData) {
      setWorkshopsError("Open this in Telegram to view workshop data.");
      return;
    }
    setWorkshopsLoading(true);
    setWorkshopsError(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("workshops-data", { body: { initData } });
        if (error) throw error;
        if (data?.ok === false || data?.error) throw new Error(data?.error ?? "failed");
        setWorkshops((data?.workshops ?? []) as WorkshopRow[]);
        setWorkshopInquiries((data?.inquiries ?? []) as WorkshopInquiry[]);
        setWorkshopSurveys((data?.surveys ?? []) as SurveyRow[]);
        setWorkshopsLoaded(true);
      } catch (e: any) {
        setWorkshopsError(e?.message ?? "failed to load workshops");
      } finally {
        setWorkshopsLoading(false);
      }
    })();
  }, [tab, isAdmin, workshopsLoaded, workshopsLoading]);


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
  // Profiles directory (community members joined with users) — Vibey + Edge Esmerelda
  useEffect(() => {
    if (authState !== "ready") return;
    let cancelled = false;
    (async () => {
      setDirectoryLoading(true);
      const { data, error } = await supabase
        .from("community_members")
        .select(
          "user_id, users:users!community_members_user_id_fkey(id, auth_user_id, name, avatar_url, profile_picture_url, telegram_photo_url, telegram_username, instagram_handle, twitter_handle, source_url, headline, bio, intentions, interests_skills, is_claimed, is_vibe_resident)",
        )
        .in("community_id", DIRECTORY_COMMUNITY_IDS)
        .limit(2000);
      if (cancelled) return;
      if (error) {
        console.error("load directory failed", error.message);
        setDirectory([]);
      } else {
        const raw = (data ?? [])
          .map((row: { users: DirectoryEntry | null }) => row.users)
          .filter((u): u is DirectoryEntry => !!u);

        // Dedupe by auth_user_id (when present) else by id. Prefer the row with the
        // most complete profile (avatar, bio, headline, telegram_username).
        const score = (u: DirectoryEntry) =>
          (u.avatar_url || u.profile_picture_url || u.telegram_photo_url ? 8 : 0) +
          (u.bio ? 4 : 0) +
          (u.telegram_username ? 2 : 0) +
          (u.headline ? 1 : 0);
        const byKey = new Map<string, DirectoryEntry>();
        for (const u of raw) {
          const key = u.auth_user_id ?? u.id;
          const existing = byKey.get(key);
          if (!existing || score(u) > score(existing)) byKey.set(key, u);
        }
        // Sort: Vibe Residents (claimed OR explicitly marked) first, then by profile richness, then alpha.
        const isResident = (u: DirectoryEntry) => !!(u.is_claimed || u.is_vibe_resident);
        const entries = Array.from(byKey.values()).sort((a, b) => {
          const residentDiff = (isResident(b) ? 1 : 0) - (isResident(a) ? 1 : 0);
          if (residentDiff !== 0) return residentDiff;
          const diff = score(b) - score(a);
          if (diff !== 0) return diff;
          return (a.name ?? "~").localeCompare(b.name ?? "~");
        });
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

  async function uploadEventCover(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large", { description: "Max 8 MB." });
      return;
    }
    setUploadingEventImage(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${VIBEY_COMMUNITY_ID}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("event-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("event-images").getPublicUrl(path);
      setNewEventImageUrl(data.publicUrl);
      toast.success("cover uploaded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error("Couldn't upload cover", { description: msg });
    } finally {
      setUploadingEventImage(false);
    }
  }



  async function uploadProjectCover(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large", { description: "Max 8 MB." });
      return;
    }
    setUploadingProjectImage(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${VIBEY_COMMUNITY_ID}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("portfolio-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("portfolio-images").getPublicUrl(path);
      setNewProjectImageUrl(data.publicUrl);
      toast.success("cover uploaded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error("Couldn't upload cover", { description: msg });
    } finally {
      setUploadingProjectImage(false);
    }
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
      .select(EVENT_SELECT)
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

  async function addProject() {
    const title = newProjectTitle.trim();
    const url = newProjectUrl.trim();
    if (!title || !url) {
      toast.error("Title and link required");
      return;
    }
    try { new URL(url); } catch {
      toast.error("That doesn't look like a valid URL");
      return;
    }
    if (!myProfile?.id) {
      toast.error("Couldn't submit project", { description: "Your profile is still loading." });
      return;
    }
    const tags = newProjectTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);

    setSavingProject(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        community_id: VIBE_CODE_RESIDENCY_COMMUNITY_ID,
        created_by: myProfile.id,
        title: title.slice(0, 120),
        url,
        description: newProjectDescription.trim() || null,
        image_url: newProjectImageUrl.trim() || null,
        tags: tags.length ? tags : null,
        status: "active",
      })
      .select(PROJECT_SELECT)
      .single();
    setSavingProject(false);
    if (error) {
      toast.error("Couldn't submit project", { description: error.message });
      return;
    }
    setProjects((prev) => [data as ProjectRow, ...prev]);
    setNewProjectTitle("");
    setNewProjectUrl("");
    setNewProjectDescription("");
    setNewProjectTags("");
    setNewProjectImageUrl("");
    setProjectComposerOpen(false);
    toast.success("project submitted 🚀");
  }



  const isMine = (m: MemoryRow) =>
    tgUserId != null &&
    Number((m.metadata as Record<string, unknown> | null)?.telegram_user_id) === tgUserId;

  const authorFor = (m: MemoryRow): MemoryAuthor | null => {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    const tid = meta.telegram_user_id;
    const tuser = meta.telegram_username;
    if (typeof tid === "number" && memoryAuthors[`tgid:${tid}`]) return memoryAuthors[`tgid:${tid}`];
    if (typeof tuser === "string" && memoryAuthors[`tguser:${tuser.toLowerCase()}`])
      return memoryAuthors[`tguser:${tuser.toLowerCase()}`];
    if (typeof tuser === "string" && tuser) return { name: null, username: tuser, avatar_url: null };
    return null;
  };

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
    { id: "profiles", label: "people", icon: UsersIcon },
    { id: "preferences", label: "you", icon: Heart },
    { id: "events", label: "events", icon: Calendar },
    { id: "projects", label: "projects", icon: Rocket },
    { id: "gallery", label: "gallery", icon: ImageIcon },
    ...(isAdmin ? [{ id: "workshops" as Tab, label: "workshops", icon: GraduationCap }] : []),
    ...(isAdmin ? [{ id: "chats" as Tab, label: "chats", icon: MessagesSquare }] : []),
    { id: "soul", label: "soul", icon: Sparkles },
    { id: "bracket", label: "bracket", icon: Trophy },
  ];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={() => setPortalOpen(true)}
          aria-label={`Open ${agent?.name ?? "Vibey"} portal`}
          className="relative w-8 h-8 rounded-lg overflow-hidden ring-1 ring-primary/30 hover:ring-primary/80 transition-all hover:shadow-[0_0_18px_-4px_hsl(var(--primary))] active:scale-95 group"
        >
          <img src={vibeyAvatar} alt="Vibey" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
          <span className="absolute inset-0 ring-1 ring-inset ring-primary/0 group-hover:ring-primary/40 rounded-lg" />
        </button>
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

      {/* Main area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Tabs — mobile only */}
        <div className="flex md:hidden items-center gap-1 px-2 py-2 border-b border-border bg-card/40 overflow-x-auto shrink-0">
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

        {/* Sidebar — desktop only */}
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card/30 overflow-y-auto">
          <div className="px-3 py-4 space-y-1">
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={
                    "flex items-center gap-2.5 w-full px-3 py-2.5 rounded font-mono text-[11px] uppercase tracking-widest transition-colors text-left " +
                    (active
                      ? "bg-primary/15 text-primary border border-primary/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent")
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </aside>

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
                {memories.map((m) => {
                  const mine = isMine(m);
                  return (
                    <MemoryCard
                      key={m.id}
                      m={m}
                      author={authorFor(m)}
                      isMine={mine}
                      canEdit
                      onEdit={setEditingMemory}
                      onDelete={deleteMemory}
                    />
                  );
                })}
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
                    {filteredMemories.map((m) => {
                      const mine = isMine(m);
                      return (
                        <MemoryCard
                          key={m.id}
                          m={m}
                          author={authorFor(m)}
                          isMine={mine}
                          canEdit={mine}
                          onEdit={setEditingMemory}
                          onDelete={deleteMemory}
                        />
                      );
                    })}
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

            {myProfile?.id && tgUserId && (
              <HeartbeatToggles userId={myProfile.id} telegramChatId={String(tgUserId)} />
            )}

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
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <UsersIcon className="w-3 h-3" />
                community · {filteredDirectory.length}{directory.length !== filteredDirectory.length ? ` / ${directory.length}` : ""}
                {directory.length > 0 && (() => {
                  const emptyCount = directory.filter((u) => !hasProfileContent(u)).length;
                  if (emptyCount === 0) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => setShowEmptyProfiles((v) => !v)}
                      className="text-[10px] font-mono normal-case tracking-normal text-muted-foreground/80 hover:text-primary transition-colors underline-offset-2 hover:underline"
                      title={showEmptyProfiles ? "hide profiles with no bio" : "show profiles with no bio"}
                    >
                      · {showEmptyProfiles ? `hide ${emptyCount} empty` : `+${emptyCount} with no bio`}
                    </button>
                  );
                })()}
              </h2>
              <input
                value={directoryQuery}
                onChange={(e) => setDirectoryQuery(e.target.value)}
                placeholder="search name, @handle, bio…"
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
                <div className="flex flex-col gap-1.5">
                  {filteredDirectory.map((u) => {
                    const avatar =
                      u.avatar_url ??
                      u.profile_picture_url ??
                      u.telegram_photo_url ??
                      null;
                    const display = u.name ?? (u.telegram_username ? `@${u.telegram_username}` : "—");
                    const preview = u.headline ?? u.bio ?? null;
                    const tags = (u.interests_skills ?? []).slice(0, 3);
                    return (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setSelectedProfile(u)}
                        className="group p-3 rounded-lg bg-card border border-border flex items-start gap-3 min-w-0 text-left hover:border-primary/50 hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-muted shrink-0 ring-1 ring-border group-hover:ring-primary/40 transition">
                          {avatar ? (
                            <img src={avatar} alt={display} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-mono text-muted-foreground bg-gradient-to-br from-primary/10 to-muted">
                              {(display ?? "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <p className="text-sm font-semibold truncate max-w-full">{display}</p>
                            {u.telegram_username && u.name && (
                              <span className="text-[10px] font-mono text-muted-foreground truncate">
                                @{u.telegram_username.replace(/^@/, "")}
                              </span>
                            )}
                            {(u.is_claimed || u.is_vibe_resident) ? (
                              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                                resident
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                unclaimed
                              </span>
                            )}
                          </div>
                          {preview && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 [overflow-wrap:anywhere]">
                              {preview}
                            </p>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {tags.map((t, i) => (
                                <span
                                  key={`${t}-${i}`}
                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
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
                  <div className="flex items-center gap-2">
                    <label className="flex-1 h-9 rounded-md border border-border bg-background hover:border-primary/60 cursor-pointer flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors">
                      {uploadingEventImage ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ImagePlus className="w-3 h-3" />
                      )}
                      {uploadingEventImage ? "uploading…" : "upload cover"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingEventImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadEventCover(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <label className="h-9 px-3 rounded-md border border-border bg-background hover:border-primary/60 cursor-pointer flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors">
                      <Camera className="w-3 h-3" />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingEventImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadEventCover(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <input
                    value={newEventImageUrl}
                    onChange={(e) => setNewEventImageUrl(e.target.value)}
                    placeholder="or paste image url"
                    className="w-full bg-background border border-border rounded-md p-2 text-xs focus:outline-none focus:border-primary/60"
                  />
                  {newEventImageUrl.trim() && (
                    <div className="relative rounded-md overflow-hidden border border-border aspect-[16/9] bg-muted">
                      <img
                        src={newEventImageUrl.trim()}
                        alt="cover preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setNewEventImageUrl("")}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:bg-background"
                        aria-label="Remove cover"
                      >
                        <X className="w-3 h-3" />
                      </button>
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
                  const canEdit = isAdmin || (myProfile?.id != null && event.created_by === myProfile.id);
                  return (
                    <button
                      type="button"
                      key={event.id}
                      onClick={() => setSelectedEvent(event as EventEditRow)}
                      className="text-left rounded-lg bg-card border border-border overflow-hidden hover:border-primary/40 transition-colors w-full"
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
                          <div className="flex items-center gap-1 shrink-0">
                            {canEdit && (
                              <span className="rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary inline-flex items-center gap-1">
                                <Pencil className="w-2.5 h-2.5" /> edit
                              </span>
                            )}
                            {event.is_featured && (
                              <span className="rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                                featured
                              </span>
                            )}
                          </div>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-3">
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
                          <span className="inline-flex items-center gap-1">
                            <UsersIcon className="w-3 h-3" />
                            {event.current_attendees ?? 0} rsvp
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ===== PROJECTS TAB ===== */}
        {tab === "projects" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Rocket className="w-3 h-3" />
                community projects · {projects.length}
              </h2>
              {isMember && (
                <button
                  type="button"
                  onClick={() => setProjectComposerOpen((o) => !o)}
                  className="h-8 px-2.5 rounded-md bg-primary/10 border border-primary/30 text-primary font-mono text-[10px] uppercase tracking-widest flex items-center gap-1.5"
                >
                  {projectComposerOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {projectComposerOpen ? "close" : "submit"}
                </button>
              )}
            </div>

            {projectComposerOpen && isMember && (
              <div className="p-3 rounded-lg bg-card border border-primary/25 space-y-2">
                <input
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="project title"
                  maxLength={120}
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
                />
                <input
                  value={newProjectUrl}
                  onChange={(e) => setNewProjectUrl(e.target.value)}
                  placeholder="https://your-project-link.com"
                  inputMode="url"
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
                />
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="what is it? (optional)"
                  rows={3}
                  maxLength={1000}
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60 resize-none"
                />
                <input
                  value={newProjectTags}
                  onChange={(e) => setNewProjectTags(e.target.value)}
                  placeholder="tags (comma separated, e.g. ai, agents, telegram)"
                  className="w-full bg-background border border-border rounded-md p-2 text-xs focus:outline-none focus:border-primary/60"
                />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="flex-1 h-9 rounded-md border border-border bg-background hover:border-primary/60 cursor-pointer flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors">
                      {uploadingProjectImage ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ImagePlus className="w-3 h-3" />
                      )}
                      {uploadingProjectImage ? "uploading…" : "upload cover"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingProjectImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadProjectCover(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <label className="h-9 px-3 rounded-md border border-border bg-background hover:border-primary/60 cursor-pointer flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors">
                      <Camera className="w-3 h-3" />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingProjectImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadProjectCover(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <input
                    value={newProjectImageUrl}
                    onChange={(e) => setNewProjectImageUrl(e.target.value)}
                    placeholder="or paste image url"
                    className="w-full bg-background border border-border rounded-md p-2 text-xs focus:outline-none focus:border-primary/60"
                  />
                  {newProjectImageUrl.trim() && (
                    <div className="relative rounded-md overflow-hidden border border-border aspect-[16/9] bg-muted">
                      <img
                        src={newProjectImageUrl.trim()}
                        alt="cover preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setNewProjectImageUrl("")}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:bg-background"
                        aria-label="Remove cover"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addProject}
                  disabled={savingProject || !newProjectTitle.trim() || !newProjectUrl.trim()}
                  className="w-full h-9 rounded-md bg-primary text-primary-foreground font-mono text-[10px] uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingProject ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
                  submit project
                </button>
              </div>
            )}

            {projectsLoading ? (
              <div className="flex items-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">no projects yet</p>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  builds, demos, and experiments from the residency will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => {
                  const author = Array.isArray(p.author) ? p.author[0] : p.author;
                  return (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg bg-card border border-border overflow-hidden hover:border-primary/40 transition-colors"
                    >
                      {p.image_url && (
                        <div className="aspect-[16/9] bg-muted overflow-hidden">
                          <img
                            src={p.image_url}
                            alt={p.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <div className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-snug truncate">{p.title}</p>
                            {author?.name && (
                              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1 truncate">
                                by {author.name}{author.telegram_username ? ` · @${author.telegram_username}` : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {p.is_featured && (
                              <span className="rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                                featured
                              </span>
                            )}
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </div>
                        {p.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {p.description}
                          </p>
                        )}
                        {p.tags && p.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {p.tags.slice(0, 6).map((t) => (
                              <span key={t} className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ===== WORKSHOPS TAB (admin only) — Local Business AI Series ===== */}

        {tab === "workshops" && isAdmin && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                <GraduationCap className="w-3 h-3" />
                Local Business AI Series · {workshops.length} workshops · {workshopInquiries.filter(i => i.status === "registered").length} registered
              </h2>
              {workshopsLoaded && (
                <button
                  onClick={() => { setWorkshopsLoaded(false); }}
                  className="px-2 py-1 rounded font-mono text-[10px] uppercase tracking-widest border border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                >
                  refresh
                </button>
              )}
            </div>

            {workshopsLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <Loader2 className="w-3 h-3 animate-spin" /> loading workshops…
              </div>
            )}
            {workshopsError && (
              <p className="text-xs text-destructive py-2">{workshopsError}</p>
            )}

            {!workshopsLoading && !workshopsError && workshops.map((w) => {
              const regs = workshopInquiries.filter((i) =>
                Array.isArray(i.workshop_weeks) && i.workshop_weeks.includes(w.week),
              );
              const registered = regs.filter((r) => r.status === "registered");
              const seatsLeft = Math.max((w.capacity ?? 0) - registered.length, 0);
              return (
                <div key={w.week} className="p-3 rounded-lg bg-card border border-border space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        week {w.week} {w.tool ? `· ${w.tool}` : ""}
                      </p>
                      <p className="text-sm font-semibold leading-tight">{w.title}</p>
                      {w.date_label && (
                        <p className="text-xs text-muted-foreground">{w.date_label}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                        {registered.length}/{w.capacity}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">{seatsLeft} seats left</p>
                    </div>
                  </div>
                  {regs.length > 0 && (
                    <ul className="space-y-1 pt-1 border-t border-border/60">
                      {regs.map((r) => (
                        <li key={r.id + "-" + w.week} className="text-xs flex items-center justify-between gap-2">
                          <span className="truncate">
                            <span className="font-medium">{r.name}</span>
                            {r.business ? <span className="text-muted-foreground"> · {r.business}</span> : null}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                            {r.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {!workshopsLoading && !workshopsError && workshopSurveys.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> intake surveys · {workshopSurveys.length}
                </h3>
                {workshopSurveys.map((s) => (
                  <div key={s.id} className="p-3 rounded-lg bg-card border border-border space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight truncate">
                        {s.business_name || s.contact_name || "Survey response"}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(s.created_at), "MMM d")}
                      </p>
                    </div>
                    {s.contact_name && (
                      <p className="text-xs text-muted-foreground">
                        {s.contact_name}{s.contact_email ? ` · ${s.contact_email}` : ""}
                      </p>
                    )}
                    {s.payload && (
                      <pre className="text-[10px] whitespace-pre-wrap font-mono text-foreground/80 mt-1 max-h-40 overflow-auto">
                        {JSON.stringify(s.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
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

        {/* ===== CHATS TAB (admin only) ===== */}
        {tab === "chats" && isAdmin && (
          <section className="space-y-2">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
              <MessagesSquare className="w-3 h-3" />
              chat history · admin
            </h2>
            <ConversationsSection />
          </section>
        )}

        {/* ===== BRACKET TAB ===== */}
        {/* ===== GALLERY TAB ===== */}
        {tab === "gallery" && (
          <GalleryTab
            communityId={VIBEY_COMMUNITY_ID}
            communityIds={[...DIRECTORY_COMMUNITY_IDS, VIBE_CODE_RESIDENCY_COMMUNITY_ID]}
            currentUserId={myProfile?.id ?? null}
            isAdmin={isAdmin}
          />
        )}

        {/* ===== BRACKET TAB ===== */}
        {tab === "bracket" && <BracketSection />}
      </div>
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

      {selectedEvent && (
        <EventEditModal
          event={selectedEvent}
          canEdit={isAdmin || (myProfile?.id != null && selectedEvent.created_by === myProfile.id)}
          canDelete={isAdmin || (myProfile?.id != null && selectedEvent.created_by === myProfile.id)}
          onClose={() => setSelectedEvent(null)}
          onSaved={(updated) => {
            setEvents((prev) => prev.map((e) => (e.id === updated.id ? (updated as EventRow) : e)));
            setSelectedEvent(updated);
          }}
          onDeleted={(id) => {
            setEvents((prev) => prev.filter((e) => e.id !== id));
            setSelectedEvent(null);
          }}
        />
      )}
      <VibeyPortal
        open={portalOpen}
        onClose={() => setPortalOpen(false)}
        agentName={agent?.name ?? "Vibey"}
        isAdmin={isAdmin}
      />
    </div>
  );
}
