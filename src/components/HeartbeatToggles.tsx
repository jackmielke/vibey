import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sun, Moon, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Kind = "morning" | "evening";

type Sub = { id: string; kind: Kind; enabled: boolean; telegram_chat_id: string | null };

export function HeartbeatToggles({ userId, telegramChatId }: { userId: string; telegramChatId: string }) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Kind | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("heartbeat_subscriptions")
        .select("id, kind, enabled, telegram_chat_id")
        .eq("user_id", userId);
      setSubs((data ?? []) as Sub[]);
      setLoading(false);
    })();
  }, [userId]);

  const getSub = (k: Kind) => subs.find((s) => s.kind === k);

  const toggle = async (kind: Kind, enabled: boolean) => {
    setUpdating(kind);
    const existing = getSub(kind);
    try {
      if (existing) {
        const { error } = await supabase
          .from("heartbeat_subscriptions")
          .update({ enabled, telegram_chat_id: telegramChatId })
          .eq("id", existing.id);
        if (error) throw error;
        setSubs((prev) => prev.map((s) => (s.id === existing.id ? { ...s, enabled, telegram_chat_id: telegramChatId } : s)));
      } else {
        const { data, error } = await supabase
          .from("heartbeat_subscriptions")
          .insert({ user_id: userId, kind, enabled, telegram_chat_id: telegramChatId })
          .select("id, kind, enabled, telegram_chat_id")
          .single();
        if (error) throw error;
        setSubs((prev) => [...prev, data as Sub]);
      }
    } catch (e) {
      toast.error("Couldn't update heartbeat", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setUpdating(null);
    }
  };

  const Row = ({ kind, icon: Icon, label, hint }: { kind: Kind; icon: typeof Sun; label: string; hint: string }) => {
    const sub = getSub(kind);
    const enabled = sub?.enabled ?? false;
    const isUpdating = updating === kind;
    return (
      <button
        type="button"
        onClick={() => toggle(kind, !enabled)}
        disabled={isUpdating || loading}
        className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${
          enabled
            ? "bg-primary/10 border-primary/40"
            : "bg-card border-border hover:border-primary/30"
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${enabled ? "text-primary" : "text-muted-foreground"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>
        </div>
        {isUpdating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        ) : (
          <span
            className={`w-9 h-5 rounded-full relative transition-colors ${
              enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-background transition-transform ${
                enabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-2 pt-1">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-0.5">
        heartbeats from vibey
      </h3>
      <Row kind="morning" icon={Sun} label="morning brief · 6am pacific" hint="what's coming up today, who to check in on" />
      <Row kind="evening" icon={Moon} label="evening reflection · 9pm pacific" hint="how the day went, anything to follow up on" />
    </div>
  );
}
