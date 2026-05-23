import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, MessageSquare, Sparkles } from "lucide-react";
import { RobotScene } from "@/components/VibeyRobot";
import { VoiceMode } from "@/components/VoiceMode";

interface VibeyPortalProps {
  open: boolean;
  onClose: () => void;
  agentName?: string;
  isAdmin?: boolean;
}

// Full set available in robot-expressive.glb mapped to vibe emojis.
const VIBES: { move: string; emoji: string; label: string }[] = [
  { move: "Wave", emoji: "👋", label: "hello" },
  { move: "Yes", emoji: "✅", label: "yes" },
  { move: "ThumbsUp", emoji: "👍", label: "noted" },
  { move: "Dance", emoji: "🕺", label: "vibing" },
  { move: "Jump", emoji: "🚀", label: "hyped" },
  { move: "Punch", emoji: "💥", label: "let's go" },
  { move: "No", emoji: "🙅", label: "nope" },
  { move: "Death", emoji: "💀", label: "rip me" },
  { move: "Sitting", emoji: "🧘", label: "chill" },
  { move: "Standing", emoji: "🧍", label: "present" },
];

export function VibeyPortal({ open, onClose, agentName = "Vibey", isAdmin }: VibeyPortalProps) {
  const [idx, setIdx] = useState(0);
  const [callOpen, setCallOpen] = useState(false);
  const userPickedRef = useRef(false);

  // Auto-cycle through vibes every 3.5s unless the user picks one
  useEffect(() => {
    if (!open) return;
    setIdx(0);
    userPickedRef.current = false;
    const t = setInterval(() => {
      if (userPickedRef.current) return;
      setIdx((i) => (i + 1) % VIBES.length);
    }, 3500);
    return () => clearInterval(t);
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !callOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, callOpen, onClose]);

  const current = VIBES[idx];
  const moves = useMemo(() => VIBES.map((v) => v.move), []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="vibey-portal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-xl flex flex-col"
        >
          {/* Aurora / scanline backdrop */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[140%] aspect-square rounded-full bg-primary/20 blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-primary/5 to-transparent" />
            <div
              className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, hsl(var(--primary)) 0 1px, transparent 1px 3px)",
              }}
            />
          </div>

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {agentName} · portal
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close portal"
              className="w-8 h-8 rounded-full border border-border/60 hover:border-primary/60 hover:text-primary flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stage */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center">
            {/* Wide stage — let the canvas breathe so the robot isn't clipped */}
            <div className="relative w-full h-full mx-auto">
              <RobotScene
                theme="dark"
                initialAction={current.move}
                moves={moves}
                scale={0.55}
                yOffset={-1.2}
                cameraZ={6}
                showControls={false}
              />
            </div>

            {/* Floating emoji badge */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.move}
                  initial={{ opacity: 0, y: -10, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="text-5xl drop-shadow-[0_0_24px_hsl(var(--primary)/0.6)]">
                    {current.emoji}
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary/90">
                    {current.label}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Vibe selector */}
          <div className="relative z-10 px-3 pt-2 pb-3 border-t border-border/40 bg-background/60 backdrop-blur-md">
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
              {VIBES.map((v, i) => {
                const active = i === idx;
                return (
                  <button
                    key={v.move}
                    onClick={() => {
                      userPickedRef.current = true;
                      setIdx(i);
                    }}
                    className={
                      "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded border transition-all whitespace-nowrap " +
                      (active
                        ? "border-primary bg-primary/15 text-primary shadow-[0_0_20px_-8px_hsl(var(--primary))]"
                        : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border")
                    }
                  >
                    <span className="text-base leading-none">{v.emoji}</span>
                    <span className="font-mono text-[8px] uppercase tracking-widest">{v.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-1">
              {isAdmin && (
                <button
                  onClick={() => setCallOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded border border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono text-[11px] uppercase tracking-widest"
                >
                  <Phone className="w-3.5 h-3.5" />
                  call {agentName.toLowerCase()}
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded border border-border hover:border-primary/40 transition-colors font-mono text-[11px] uppercase tracking-widest"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                back to brain
              </button>
            </div>
          </div>

          {/* Voice mode modal mounted on top */}
          <VoiceMode open={callOpen} onClose={() => setCallOpen(false)} agentName={agentName} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
