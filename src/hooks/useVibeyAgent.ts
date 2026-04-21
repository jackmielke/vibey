import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VIBEY_AGENT_ID } from "@/lib/vibey";
import { toast } from "sonner";

type AgentRow = {
  id: string;
  name: string;
  intro_message: string | null;
  avatar_url: string | null;
  system_prompt: string;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
};

export function useVibeyAgent() {
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, intro_message, avatar_url, system_prompt, model, temperature, max_tokens")
        .eq("id", VIBEY_AGENT_ID)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        toast.error("Couldn't load Vibey", { description: error.message });
      } else {
        setAgent(data as AgentRow | null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (patch: Partial<AgentRow>) => {
      if (!agent) return;
      // Optimistic update
      setAgent((prev) => (prev ? { ...prev, ...patch } : prev));
      setSaving(true);
      const { error } = await supabase
        .from("agents")
        .update(patch)
        .eq("id", VIBEY_AGENT_ID);
      setSaving(false);
      if (error) {
        toast.error("Save failed", { description: error.message });
      } else {
        toast.success("Saved");
      }
    },
    [agent]
  );

  return { agent, loading, saving, save };
}
