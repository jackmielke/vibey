import { useEffect, useState, useCallback, useRef } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceModeProps {
  open: boolean;
  onClose: () => void;
  agentName: string;
}

type Transcript = { id: string; role: "user" | "agent"; text: string };

export function VoiceMode(props: VoiceModeProps) {
  return (
    <ConversationProvider>
      <VoiceModeInner {...props} />
    </ConversationProvider>
  );
}

function VoiceModeInner({ open, onClose, agentName }: VoiceModeProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("voice connected");
    },
    onDisconnect: () => {
      console.log("voice disconnected");
    },
    onError: (error) => {
      console.error("voice error:", error);
      toast.error("Voice error", {
        description: typeof error === "string" ? error : "Connection failed",
      });
    },
    onMessage: (message: { source?: string; message?: string } | unknown) => {
      const m = message as { source?: string; message?: string };
      if (m?.message && m?.source) {
        setTranscripts((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            role: m.source === "user" ? "user" : "agent",
            text: m.message!,
          },
        ]);
      }
    },
  });

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  const start = useCallback(async () => {
    setIsStarting(true);
    setTranscripts([]);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke("elevenlabs-voice-setup");
      if (error) throw error;
      if (!data?.token) throw new Error("No token returned");

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start voice", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsStarting(false);
    }
  }, [conversation]);

  const stop = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  // Auto-start when modal opens
  useEffect(() => {
    if (open && conversation.status === "disconnected" && !isStarting) {
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-end when modal closes
  useEffect(() => {
    if (!open && conversation.status === "connected") {
      conversation.endSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const handleClose = async () => {
    if (conversation.status === "connected") await conversation.endSession();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {isStarting
                  ? "connecting"
                  : isConnected
                  ? isSpeaking
                    ? `${agentName} speaking`
                    : "listening"
                  : "idle"}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Orb */}
          <div className="flex-1 flex flex-col items-center justify-center gap-12 px-6">
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* Outer pulse rings */}
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/10"
                animate={{
                  scale: isSpeaking ? [1, 1.4, 1] : isConnected ? [1, 1.15, 1] : 1,
                  opacity: isSpeaking ? [0.4, 0, 0.4] : isConnected ? [0.3, 0.1, 0.3] : 0.2,
                }}
                transition={{
                  duration: isSpeaking ? 1.2 : 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="absolute inset-8 rounded-full bg-primary/20"
                animate={{
                  scale: isSpeaking ? [1, 1.2, 1] : isConnected ? [1, 1.08, 1] : 1,
                }}
                transition={{
                  duration: isSpeaking ? 0.8 : 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              {/* Core orb */}
              <motion.div
                className="relative w-40 h-40 rounded-full bg-gradient-to-br from-primary to-primary/40 shadow-[0_0_80px_hsl(var(--primary)/0.6)]"
                animate={{
                  scale: isSpeaking ? [1, 1.05, 1] : 1,
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              {isStarting && (
                <Loader2 className="absolute h-8 w-8 animate-spin text-background" />
              )}
            </div>

            {/* Live transcript */}
            <div className="w-full max-w-xl h-32 overflow-hidden">
              <div className="h-full overflow-y-auto space-y-2 text-center">
                {transcripts.slice(-4).map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-sm ${
                      t.role === "user"
                        ? "text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {t.role === "user" ? "you: " : ""}
                    {t.text}
                  </motion.div>
                ))}
                <div ref={transcriptsEndRef} />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={() => setMuted((m) => !m)}
                disabled={!isConnected}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                className="h-14 px-8 rounded-full"
                onClick={isConnected ? stop : handleClose}
              >
                {isConnected ? "End" : "Cancel"}
              </Button>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Powered by ElevenLabs
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
