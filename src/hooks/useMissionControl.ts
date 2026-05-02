import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VIBEY_AGENT_ID, VIBEY_COMMUNITY_ID } from "@/lib/vibey";

export type RecentMessage = {
  id: string;
  user: string;
  message: string;
  response: string;
  created_at: string;
  channel: "telegram" | "web";
};

export type AutomationRunRow = {
  id: string;
  status: string | null;
  started_at: string;
  duration_ms: number | null;
  error: string | null;
  automation_name?: string | null;
};

export type MissionStats = {
  messages24h: number;
  messages7d: number;
  activeUsers7d: number;
  totalRelationships: number;
  totalMemories: number;
  automationsEnabled: number;
  automationsTotal: number;
  tokensToday: number;
  lastMessageAt: string | null;
};

export function useMissionControl() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MissionStats | null>(null);
  const [recent, setRecent] = useState<RecentMessage[]>([]);
  const [runs, setRuns] = useState<AutomationRunRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    (async () => {
      const [
        msgs24,
        msgs7,
        recentRows,
        relCount,
        memCount,
        automations,
        runRows,
        tokenRows,
      ] = await Promise.all([
        supabase
          .from("agent_chat_logs")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", VIBEY_AGENT_ID)
          .gte("created_at", since24),
        supabase
          .from("agent_chat_logs")
          .select("telegram_user_id, telegram_username, created_at")
          .eq("agent_id", VIBEY_AGENT_ID)
          .gte("created_at", since7)
          .limit(1000),
        supabase
          .from("agent_chat_logs")
          .select("id, telegram_username, telegram_chat_id, user_message, agent_response, created_at")
          .eq("agent_id", VIBEY_AGENT_ID)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("vibey_relationships")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", VIBEY_AGENT_ID),
        supabase
          .from("memories")
          .select("id", { count: "exact", head: true })
          .eq("community_id", VIBEY_COMMUNITY_ID),
        supabase
          .from("automations")
          .select("id, name, enabled")
          .eq("community_id", VIBEY_COMMUNITY_ID),
        supabase
          .from("automation_runs")
          .select("id, status, started_at, duration_ms, error, automation_id")
          .eq("community_id", VIBEY_COMMUNITY_ID)
          .order("started_at", { ascending: false })
          .limit(6),
        supabase
          .from("agent_chat_logs")
          .select("tokens_used")
          .eq("agent_id", VIBEY_AGENT_ID)
          .gte("created_at", since24)
          .limit(1000),
      ]);

      if (cancelled) return;

      const uniqueUsers = new Set<string>();
      (msgs7.data ?? []).forEach((r: any) => {
        const k = r.telegram_user_id?.toString() ?? r.telegram_username ?? "";
        if (k) uniqueUsers.add(k);
      });

      const tokensToday = (tokenRows.data ?? []).reduce(
        (sum: number, r: any) => sum + (r.tokens_used ?? 0),
        0
      );

      const automationsList = automations.data ?? [];
      const nameById = new Map<string, string>();
      automationsList.forEach((a: any) => nameById.set(a.id, a.name));

      setStats({
        messages24h: msgs24.count ?? 0,
        messages7d: msgs7.data?.length ?? 0,
        activeUsers7d: uniqueUsers.size,
        totalRelationships: relCount.count ?? 0,
        totalMemories: memCount.count ?? 0,
        automationsEnabled: automationsList.filter((a: any) => a.enabled).length,
        automationsTotal: automationsList.length,
        tokensToday,
        lastMessageAt: recentRows.data?.[0]?.created_at ?? null,
      });

      setRecent(
        (recentRows.data ?? []).map((r: any) => ({
          id: r.id,
          user: r.telegram_username ?? "anonymous",
          message: r.user_message ?? "",
          response: r.agent_response ?? "",
          created_at: r.created_at,
          channel: r.telegram_chat_id ? "telegram" : "web",
        }))
      );

      setRuns(
        (runRows.data ?? []).map((r: any) => ({
          id: r.id,
          status: r.status,
          started_at: r.started_at,
          duration_ms: r.duration_ms,
          error: r.error,
          automation_name: nameById.get(r.automation_id) ?? "Automation",
        }))
      );

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, stats, recent, runs };
}
