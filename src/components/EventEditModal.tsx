import { useEffect, useState } from "react";
import { Loader2, X, Pencil, Trash2, ImagePlus, Camera, MapPin, Calendar, Users as UsersIcon, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VIBEY_COMMUNITY_ID } from "@/lib/vibey";

export type EventEditRow = {
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

type Attendee = {
  id: string;
  rsvp_status: string | null;
  attended: boolean | null;
  created_at: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    profile_picture_url: string | null;
    telegram_username: string | null;
  } | null;
};

type Creator = {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function toLocalInput(iso: string): string {
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventEditModal({
  event,
  canEdit,
  canDelete,
  onClose,
  onSaved,
  onDeleted,
}: {
  event: EventEditRow;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (e: EventEditRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [location, setLocation] = useState(event.event_location ?? "");
  const [hostedBy, setHostedBy] = useState(event.hosted_by ?? "");
  const [imageUrl, setImageUrl] = useState(event.event_image_url ?? "");
  const [start, setStart] = useState(toLocalInput(event.event_start_time));
  const [end, setEnd] = useState(toLocalInput(event.event_end_time));
  const [tagsStr, setTagsStr] = useState((event.tags ?? []).join(", "));
  const [maxAttendees, setMaxAttendees] = useState(
    event.max_attendees != null ? String(event.max_attendees) : "",
  );

  const [creator, setCreator] = useState<Creator | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDetails(true);
      const [creatorRes, attRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, username, avatar_url")
          .eq("id", event.created_by)
          .maybeSingle(),
        supabase
          .from("event_attendees")
          .select(
            "id, rsvp_status, attended, created_at, user:users!event_attendees_user_id_fkey(id, name, username, avatar_url, profile_picture_url, telegram_username)",
          )
          .eq("event_id", event.id)
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (creatorRes.data) setCreator(creatorRes.data as Creator);
      if (attRes.data) setAttendees(attRes.data as unknown as Attendee[]);
      setLoadingDetails(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id, event.created_by]);

  async function uploadCover(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large", { description: "Pick something under 5 MB." });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${VIBEY_COMMUNITY_ID}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("event-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("event-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("cover uploaded");
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      toast.error("Invalid date/time");
      return;
    }
    if (e <= s) {
      toast.error("End must be after start");
      return;
    }
    setSaving(true);
    const tagsArr = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const { data, error } = await supabase
      .from("events")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        event_location: location.trim() || null,
        event_image_url: imageUrl.trim() || null,
        hosted_by: hostedBy.trim() || null,
        event_start_time: s.toISOString(),
        event_end_time: e.toISOString(),
        tags: tagsArr.length ? tagsArr : null,
        max_attendees: maxAttendees.trim() ? Number(maxAttendees) : null,
      })
      .eq("id", event.id)
      .select(
        "id, title, description, event_start_time, event_end_time, event_location, event_type, event_image_url, hosted_by, is_featured, tags, created_by, created_at, updated_at, current_attendees, max_attendees, is_public, registration_required",
      )
      .single();
    setSaving(false);
    if (error) {
      toast.error("Couldn't save", { description: error.message });
      return;
    }
    onSaved(data as EventEditRow);
    setEditMode(false);
    toast.success("event updated");
  }

  async function remove() {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setDeleting(true);
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    setDeleting(false);
    if (error) {
      toast.error("Couldn't delete", { description: error.message });
      return;
    }
    onDeleted(event.id);
    toast.success("event deleted");
    onClose();
  }

  const sDate = new Date(event.event_start_time);
  const eDate = new Date(event.event_end_time);
  const sameDay = sDate.toDateString() === eDate.toDateString();

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-lg overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            {editMode ? "edit event" : "event details"}
          </p>
          <div className="flex items-center gap-1">
            {!editMode && canEdit && (
              <button
                onClick={() => setEditMode(true)}
                className="h-7 px-2 rounded bg-primary/10 border border-primary/30 text-primary font-mono text-[10px] uppercase tracking-widest flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> edit
              </button>
            )}
            {!editMode && canDelete && (
              <button
                onClick={remove}
                disabled={deleting}
                className="h-7 px-2 rounded bg-destructive/10 border border-destructive/40 text-destructive font-mono text-[10px] uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                delete
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {/* Cover */}
          {(editMode ? imageUrl : event.event_image_url) && (
            <div className="aspect-[16/9] rounded-md overflow-hidden bg-muted border border-border">
              <img
                src={(editMode ? imageUrl : event.event_image_url) ?? ""}
                alt={event.title}
                className="w-full h-full object-cover"
                onError={(ev) => {
                  (ev.currentTarget.parentElement as HTMLElement).style.display = "none";
                }}
              />
            </div>
          )}

          {!editMode ? (
            <>
              <div>
                <h3 className="text-lg font-semibold leading-snug">{event.title}</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest text-primary mt-1">
                  {format(sDate, "EEE, MMM d, yyyy")} · {format(sDate, "h:mm a")} –{" "}
                  {sameDay ? format(eDate, "h:mm a") : format(eDate, "EEE MMM d, h:mm a")}
                </p>
              </div>

              {event.description && (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {event.description}
                </p>
              )}

              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                {event.event_location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {event.event_location}
                  </span>
                )}
                {event.hosted_by && (
                  <span className="inline-flex items-center gap-1">
                    hosted by · {event.hosted_by}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(sDate, { addSuffix: true })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="w-3 h-3" />
                  {event.current_attendees ?? 0}
                  {event.max_attendees ? ` / ${event.max_attendees}` : ""} rsvp
                </span>
              </div>

              {event.tags && event.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {event.tags.map((t) => (
                    <span
                      key={t}
                      className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-border text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta */}
              <div className="rounded-md bg-background border border-border p-3 space-y-1.5 text-[11px] text-muted-foreground font-mono">
                <div className="flex justify-between gap-2">
                  <span>created by</span>
                  <span className="text-foreground/80 truncate">
                    {creator?.name ?? creator?.username ?? event.hosted_by ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>created</span>
                  <span className="text-foreground/80">{format(new Date(event.created_at), "MMM d, yyyy h:mm a")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>last edited</span>
                  <span className="text-foreground/80">{format(new Date(event.updated_at), "MMM d, yyyy h:mm a")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>visibility</span>
                  <span className="text-foreground/80">{event.is_public ? "public" : "private"}</span>
                </div>
              </div>

              {/* Attendees */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <UsersIcon className="w-3 h-3" />
                  rsvps · {attendees.length}
                </p>
                {loadingDetails ? (
                  <div className="flex items-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : attendees.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">no rsvps yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {attendees.map((a) => {
                      const u = a.user;
                      const avatar = u?.avatar_url ?? u?.profile_picture_url ?? null;
                      const display = u?.name ?? (u?.telegram_username ? `@${u.telegram_username}` : u?.username ?? "—");
                      return (
                        <li
                          key={a.id}
                          className="flex items-center gap-2 p-2 rounded-md bg-background border border-border"
                        >
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-muted shrink-0">
                            {avatar ? (
                              <img src={avatar} alt={display} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                                {(display ?? "?").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate">{display}</p>
                            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                              {a.rsvp_status ?? "going"}
                              {a.attended ? " · attended" : ""}
                            </p>
                          </div>
                          <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Edit form */}
              <label className="block space-y-1">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60 resize-y"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">venue / location</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">hosted by</span>
                <input
                  value={hostedBy}
                  onChange={(e) => setHostedBy(e.target.value)}
                  className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:border-primary/60"
                />
              </label>

              {/* Cover */}
              <div className="space-y-1.5">
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">cover photo</span>
                <div className="flex items-center gap-2">
                  <label className="flex-1 h-9 rounded-md border border-border bg-background hover:border-primary/60 cursor-pointer flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                    {uploading ? "uploading…" : "upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadCover(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <label className="h-9 px-3 rounded-md border border-border bg-background hover:border-primary/60 cursor-pointer flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <Camera className="w-3 h-3" />
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadCover(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="or paste image url"
                  className="w-full bg-background border border-border rounded-md p-2 text-xs focus:outline-none focus:border-primary/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">starts</span>
                  <input
                    type="datetime-local"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full bg-background border border-border rounded-md p-2 text-xs focus:outline-none focus:border-primary/60"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">ends</span>
                  <input
                    type="datetime-local"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full bg-background border border-border rounded-md p-2 text-xs focus:outline-none focus:border-primary/60"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">tags</span>
                  <input
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    placeholder="comma, separated"
                    className="w-full bg-background border border-border rounded-md p-2 text-xs font-mono focus:outline-none focus:border-primary/60"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">max rsvps</span>
                  <input
                    type="number"
                    min={0}
                    value={maxAttendees}
                    onChange={(e) => setMaxAttendees(e.target.value)}
                    placeholder="unlimited"
                    className="w-full bg-background border border-border rounded-md p-2 text-xs focus:outline-none focus:border-primary/60"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setEditMode(false)}
                  className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground px-3 py-1.5"
                >
                  cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40 flex items-center gap-1"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  save
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
