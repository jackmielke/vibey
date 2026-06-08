import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Loader2, Plus, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Photo = {
  id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: { id: string; name: string | null; telegram_username: string | null; avatar_url: string | null } | null;
};

interface Props {
  communityId: string;
  communityIds?: string[]; // optional: read across multiple communities
  currentUserId: string | null; // public users.id
  isAdmin: boolean;
}

const BUCKET = "gallery-photos";
const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const PHOTO_SELECT =
  "id, image_url, title, description, uploaded_by, created_at, uploader:users!gallery_photos_uploaded_by_fkey(id, name, telegram_username, avatar_url)";

export function GalleryTab({ communityId, communityIds, currentUserId, isAdmin }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readIds = communityIds && communityIds.length > 0 ? communityIds : [communityId];
  const readIdsKey = readIds.join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("gallery_photos")
        .select(PHOTO_SELECT)
        .in("community_id", readIds)
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load gallery", { description: error.message });
      } else {
        setPhotos((data ?? []) as unknown as Photo[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [readIdsKey]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!currentUserId) {
      toast.error("Sign in to upload");
      return;
    }
    setUploading(true);
    const uploaded: Photo[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name}: not an image`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: too large (max 15MB)`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${communityId}/${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`Upload failed: ${file.name}`, { description: upErr.message });
          continue;
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const { data: row, error: insErr } = await supabase
          .from("gallery_photos")
          .insert({
            community_id: communityId,
            image_url: pub.publicUrl,
            uploaded_by: currentUserId,
            is_visible: true,
          })
          .select(PHOTO_SELECT)
          .single();
        if (insErr) {
          toast.error(`Saved upload but row insert failed: ${file.name}`, {
            description: insErr.message,
          });
          continue;
        }
        uploaded.push(row as unknown as Photo);
      }
      if (uploaded.length > 0) {
        setPhotos((prev) => [...uploaded, ...prev]);
        toast.success(`Added ${uploaded.length} photo${uploaded.length > 1 ? "s" : ""}`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (photo: Photo) => {
    if (!confirm("Delete this photo?")) return;
    const { error } = await supabase.from("gallery_photos").delete().eq("id", photo.id);
    if (error) {
      toast.error("Couldn't delete", { description: error.message });
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setLightbox(null);
    toast.success("Photo removed");
  };

  const canUpload = Boolean(currentUserId);

  const handleDragEnter = (e: React.DragEvent) => {
    if (!canUpload) return;
    if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!canUpload) return;
    if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!canUpload) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!canUpload) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const dt = new DataTransfer();
      Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .forEach((f) => dt.items.add(f));
      handleFiles(dt.files);
    }
  };

  return (
    <section
      className="space-y-3 relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3" />
          gallery · {photos.length} photos
        </h2>
        {currentUserId && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-widest bg-primary/15 text-primary border border-primary/40 hover:bg-primary/25 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            {uploading ? "uploading…" : "add photo"}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No photos yet. Be the first!</p>
          {canUpload && (
            <p className="hidden md:block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              drag &amp; drop images anywhere here
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <motion.button
              key={p.id}
              type="button"
              layout
              onClick={() => setLightbox(p)}
              className="relative aspect-square rounded-md overflow-hidden bg-muted active:scale-95 transition-transform"
            >
              <img
                src={p.image_url}
                alt={p.title || "photo"}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
            onClick={() => setLightbox(null)}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                {lightbox.uploader?.name ||
                  (lightbox.uploader?.telegram_username
                    ? `@${lightbox.uploader.telegram_username}`
                    : "anonymous")}
              </p>
              <div className="flex items-center gap-1">
                {(isAdmin || (currentUserId && lightbox.uploaded_by === currentUserId)) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(lightbox);
                    }}
                    className="p-2 rounded text-muted-foreground hover:text-destructive"
                    aria-label="Delete photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="p-2 rounded text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              className="flex-1 flex items-center justify-center p-2 overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightbox.image_url}
                alt={lightbox.title || "photo"}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
            {(lightbox.title || lightbox.description) && (
              <div className="px-4 py-3 border-t border-border space-y-1">
                {lightbox.title && <p className="text-sm font-semibold">{lightbox.title}</p>}
                {lightbox.description && (
                  <p className="text-xs text-muted-foreground">{lightbox.description}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 bg-primary/10 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="border-2 border-dashed border-primary rounded-xl px-8 py-10 bg-background/80 flex flex-col items-center gap-3">
              <Plus className="w-8 h-8 text-primary" />
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                drop to upload
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
