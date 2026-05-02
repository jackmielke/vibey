import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Brain,
  Heart,
  IdCard,
  MessageCircle,
  MessagesSquare,
  Sparkles,
  Users,
  Wrench,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMissionControl } from "@/hooks/useMissionControl";
import { useVibeyAgent } from "@/hooks/useVibeyAgent";
import vibeyAvatar from "@/assets/vibey-avatar.png";

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Tile({
  className,
  children,
  to,
}: {
  className?: string;
  children: React.ReactNode;
  to?: string;
}) {
  const inner = (
    <motion.div
      whileHover={to ? { y: -2 } : undefined}
      transition={{ duration: 0.15 }}
      className={cn(
        "group relative h-full rounded-md border border-border bg-card p-4 overflow-hidden",
        to && "cursor-pointer hover:border-primary/40 transition-colors",
        className
      )}
    >
      {children}
      {to && (
        <ArrowUpRight className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </motion.div>
  );
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
}

function StatNumber({ value, loading }: { value: number | string; loading: boolean }) {
  if (loading) return <Skeleton className="h-9 w-20" />;
  return (
    <div className="font-mono text-3xl md:text-4xl font-bold tabular-nums tracking-tight text-foreground">
      {value}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-label">{children}</p>;
}

const SHORTCUTS = [
  { to: "/soul", label: "Soul", icon: Sparkles },
  { to: "/identity", label: "Identity", icon: IdCard },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/relationships", label: "Members", icon: Users },
  { to: "/automations", label: "Heartbeat", icon: Heart },
];

export default function MissionControl() {
  const { loading, stats, recent, runs } = useMissionControl();
  const { agent } = useVibeyAgent();

  const lastRun = runs[0];
  const healthOk = lastRun ? lastRun.status === "succeeded" || lastRun.status === "success" : true;

  return (
    <PageShell title="Mission Control" description="Live pulse of everything Vibey.">
      {/* Hero strip */}
      <div className="relative rounded-md border border-border bg-card p-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-md overflow-hidden ring-1 ring-primary/30 shrink-0">
            <img src={vibeyAvatar} alt="Vibey" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-label">Agent online</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            </div>
            <p className="text-lg font-semibold leading-tight truncate">{agent?.name ?? "Vibey"}</p>
            <p className="text-xs text-muted-foreground font-mono truncate">{agent?.model ?? "—"}</p>
          </div>
          <div className="hidden sm:block text-right">
            <Label>Last message</Label>
            <p className="font-mono text-sm">{timeAgo(stats?.lastMessageAt ?? null)}</p>
          </div>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 auto-rows-[110px]">
        {/* Stat tiles */}
        <Tile>
          <Label>Messages 24h</Label>
          <div className="mt-2"><StatNumber value={stats?.messages24h ?? 0} loading={loading} /></div>
          <MessageCircle className="absolute bottom-3 right-3 h-4 w-4 text-primary/40" />
        </Tile>

        <Tile>
          <Label>Active users 7d</Label>
          <div className="mt-2"><StatNumber value={stats?.activeUsers7d ?? 0} loading={loading} /></div>
          <Users className="absolute bottom-3 right-3 h-4 w-4 text-primary/40" />
        </Tile>

        <Tile>
          <Label>Memories</Label>
          <div className="mt-2"><StatNumber value={stats?.totalMemories ?? 0} loading={loading} /></div>
          <Brain className="absolute bottom-3 right-3 h-4 w-4 text-primary/40" />
        </Tile>

        <Tile>
          <Label>Tokens 24h</Label>
          <div className="mt-2">
            <StatNumber
              value={loading ? 0 : (stats!.tokensToday > 999 ? `${(stats!.tokensToday / 1000).toFixed(1)}k` : stats!.tokensToday)}
              loading={loading}
            />
          </div>
          <Zap className="absolute bottom-3 right-3 h-4 w-4 text-primary/40" />
        </Tile>

        {/* Recent messages — wide tall */}
        <Tile className="col-span-2 md:col-span-2 row-span-3" to="/conversations">
          <div className="flex items-center justify-between mb-3">
            <Label>Recent messages</Label>
            <MessagesSquare className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="space-y-3 overflow-hidden">
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
            {!loading && recent.length === 0 && (
              <p className="text-xs text-muted-foreground">No messages yet.</p>
            )}
            {!loading && recent.slice(0, 5).map((m) => (
              <div key={m.id} className="border-l-2 border-primary/40 pl-3 py-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs font-semibold truncate">@{m.user}</span>
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">{m.channel}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{timeAgo(m.created_at)}</span>
                </div>
                <p className="text-xs text-foreground/80 line-clamp-1">{m.message || "—"}</p>
              </div>
            ))}
          </div>
        </Tile>

        {/* Members */}
        <Tile to="/relationships">
          <Label>Members</Label>
          <div className="mt-2"><StatNumber value={stats?.totalRelationships ?? 0} loading={loading} /></div>
          <Users className="absolute bottom-3 right-3 h-4 w-4 text-primary/40" />
        </Tile>

        {/* Automations */}
        <Tile to="/automations">
          <Label>Automations</Label>
          <div className="mt-2 flex items-baseline gap-1">
            <StatNumber value={stats?.automationsEnabled ?? 0} loading={loading} />
            {!loading && (
              <span className="font-mono text-sm text-muted-foreground">/ {stats?.automationsTotal ?? 0}</span>
            )}
          </div>
          <Heart className="absolute bottom-3 right-3 h-4 w-4 text-primary/40" />
        </Tile>

        {/* Health — wide */}
        <Tile className="col-span-2 row-span-2" to="/automations">
          <div className="flex items-center justify-between mb-2">
            <Label>System health</Label>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                healthOk ? "bg-primary" : "bg-destructive"
              )} />
              <span className="font-mono text-[10px] uppercase tracking-wider">
                {healthOk ? "operational" : "attention"}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            {!loading && runs.length === 0 && (
              <p className="text-xs text-muted-foreground">No automation runs yet.</p>
            )}
            {!loading && runs.slice(0, 4).map((r) => {
              const ok = r.status === "succeeded" || r.status === "success";
              const running = r.status === "running" || r.status === "started";
              return (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  {running ? (
                    <Loader2 className="h-3 w-3 text-primary animate-spin shrink-0" />
                  ) : ok ? (
                    <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-destructive shrink-0" />
                  )}
                  <span className="truncate flex-1">{r.automation_name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {timeAgo(r.started_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </Tile>

        {/* Activity rate */}
        <Tile>
          <Label>Messages 7d</Label>
          <div className="mt-2"><StatNumber value={stats?.messages7d ?? 0} loading={loading} /></div>
          <Activity className="absolute bottom-3 right-3 h-4 w-4 text-primary/40" />
        </Tile>

        <Tile to="/memory">
          <Label>Knowledge</Label>
          <div className="mt-2 font-mono text-sm font-semibold">Edit memory →</div>
          <Brain className="absolute bottom-3 right-3 h-4 w-4 text-primary/40" />
        </Tile>
      </div>

      {/* Quick edit shortcuts */}
      <div>
        <p className="text-label mb-2">Quick edit</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group rounded-md border border-border bg-card p-3 flex flex-col items-center justify-center gap-1.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <s.icon className="h-4 w-4 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-wider">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
