import { useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus, Trophy as TrophyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MATCHES,
  PLAYERS,
  R16,
  QF,
  SF,
  FINAL,
  type Match,
  type BracketMatch,
} from "@/data/tournament";

type SubTab = "picks" | "bracket" | "leaderboard";

export const BracketSection = () => {
  const [sub, setSub] = useState<SubTab>("picks");

  return (
    <section className="space-y-4">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Match Day · mock data
        </p>
        <h2 className="font-semibold text-lg leading-tight mt-0.5 flex items-center gap-2">
          <TrophyIcon className="w-4 h-4 text-primary" />
          Golden Goal
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Pick winners, track the bracket, and climb the community leaderboard.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["picks", "bracket", "leaderboard"] as SubTab[]).map((id) => {
          const active = sub === id;
          return (
            <button
              key={id}
              onClick={() => setSub(id)}
              className={cn(
                "px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors border-b-2 -mb-px",
                active
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {id}
            </button>
          );
        })}
      </div>

      {sub === "picks" && <PicksView />}
      {sub === "bracket" && <BracketView />}
      {sub === "leaderboard" && <LeaderboardView />}
    </section>
  );
};

/* ---------------- Picks ---------------- */

const PicksView = () => {
  const live = MATCHES.filter((m) => m.status === "live");
  const upcoming = MATCHES.filter((m) => m.status === "scheduled");
  const finals = MATCHES.filter((m) => m.status === "final");

  return (
    <div className="space-y-5">
      {live.length > 0 && <MatchGroup title="Live" matches={live} />}
      <MatchGroup title="Upcoming" matches={upcoming} />
      <MatchGroup title="Recent Results" matches={finals} />
    </div>
  );
};

const MatchGroup = ({ title, matches }: { title: string; matches: Match[] }) => (
  <div className="space-y-2">
    <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {title}
    </h3>
    <div className="space-y-2">
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  </div>
);

const MatchCard = ({ match }: { match: Match }) => {
  const [pick, setPick] = useState<"home" | "draw" | "away" | null>(null);
  const [homePred, setHomePred] = useState(1);
  const [awayPred, setAwayPred] = useState(1);
  const locked = match.status !== "scheduled";

  return (
    <article className="rounded border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest">
        <span className="text-muted-foreground truncate">
          {match.stage === "Group" ? `Group ${match.group}` : match.stage} · {match.venue}
        </span>
        {match.status === "live" && (
          <span className="flex items-center gap-1 text-primary font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            LIVE {match.minute}'
          </span>
        )}
        {match.status === "final" && <span className="text-muted-foreground">FT</span>}
        {match.status === "scheduled" && (
          <span className="text-primary">
            {new Date(match.date).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <TeamRow team={match.home} score={match.homeScore} live={match.status === "live"} />
          <div className="font-mono text-xs text-muted-foreground/60">vs</div>
          <TeamRow
            team={match.away}
            score={match.awayScore}
            live={match.status === "live"}
            reverse
          />
        </div>

        <div className="mt-3 border-t border-border pt-3">
          {locked ? (
            <LockedPickReadout match={match} />
          ) : (
            <>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Your pick · 3 pts winner · +5 exact score
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <PickBtn active={pick === "home"} onClick={() => setPick("home")}>
                  {match.home.code}
                </PickBtn>
                <PickBtn active={pick === "draw"} onClick={() => setPick("draw")}>
                  Draw
                </PickBtn>
                <PickBtn active={pick === "away"} onClick={() => setPick("away")}>
                  {match.away.code}
                </PickBtn>
              </div>
              <div className="mt-2.5 flex items-center justify-center gap-3">
                <ScorePicker value={homePred} onChange={setHomePred} />
                <span className="text-muted-foreground">—</span>
                <ScorePicker value={awayPred} onChange={setAwayPred} />
                <span className="ml-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  score
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
};

const TeamRow = ({
  team,
  score,
  live,
  reverse,
}: {
  team: Match["home"];
  score?: number;
  live?: boolean;
  reverse?: boolean;
}) => (
  <div className={cn("flex flex-1 items-center gap-2 min-w-0", reverse && "flex-row-reverse text-right")}>
    <div className="text-2xl shrink-0">{team.flag}</div>
    <div className={cn("min-w-0", reverse && "text-right")}>
      <div className="font-semibold text-sm leading-none truncate">{team.name}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
        {team.code}
      </div>
    </div>
    {score !== undefined && (
      <div
        className={cn(
          "font-semibold text-2xl tabular-nums leading-none",
          live ? "text-primary" : "text-foreground"
        )}
      >
        {score}
      </div>
    )}
  </div>
);

const PickBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded border font-mono uppercase tracking-widest text-[10px] py-2 transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground font-semibold"
        : "border-border bg-secondary/40 text-foreground/70 hover:border-primary/50 hover:text-foreground"
    )}
  >
    {children}
  </button>
);

const ScorePicker = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <div className="flex items-center gap-1">
    <button
      onClick={() => onChange(Math.max(0, value - 1))}
      className="h-6 w-6 rounded border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary transition-colors text-sm"
    >
      −
    </button>
    <div className="font-semibold text-lg w-6 text-center tabular-nums">{value}</div>
    <button
      onClick={() => onChange(value + 1)}
      className="h-6 w-6 rounded border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary transition-colors text-sm"
    >
      +
    </button>
  </div>
);

const LockedPickReadout = ({ match }: { match: Match }) => {
  const correct =
    match.status === "final" && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Your pick
        </div>
        <div className="font-semibold text-sm mt-0.5">{match.home.code} Win · 2-1</div>
      </div>
      {match.status === "final" ? (
        <div
          className={cn(
            "rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest font-bold",
            correct
              ? "bg-primary text-primary-foreground"
              : "bg-destructive/20 text-destructive border border-destructive/40"
          )}
        >
          {correct ? "+3 PTS" : "Missed"}
        </div>
      ) : (
        <div className="rounded border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
          Locked
        </div>
      )}
    </div>
  );
};

/* ---------------- Bracket ---------------- */

const BracketView = () => (
  <div className="overflow-x-auto -mx-4 px-4 pb-3">
    <div className="flex gap-4 min-w-[900px] py-3">
      <BracketColumn title="Round of 16" matches={R16} gap={12} />
      <BracketColumn title="Quarter-Finals" matches={QF} gap={76} />
      <BracketColumn title="Semi-Finals" matches={SF} gap={200} />
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Final
        </div>
        <Trophy className="h-8 w-8 text-primary" strokeWidth={2} />
        <MatchBox m={FINAL[0]} />
        <div className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
          Champion TBD
        </div>
      </div>
    </div>
  </div>
);

const BracketColumn = ({
  title,
  matches,
  gap,
}: {
  title: string;
  matches: BracketMatch[];
  gap: number;
}) => (
  <div className="flex flex-col items-center">
    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
      {title}
    </div>
    <div className="flex flex-col justify-around flex-1" style={{ gap: `${gap}px` }}>
      {matches.map((m) => (
        <MatchBox key={m.id} m={m} />
      ))}
    </div>
  </div>
);

const MatchBox = ({ m }: { m: BracketMatch }) => (
  <div className="rounded border border-border bg-card overflow-hidden w-36">
    <BracketSlot slot={m.top} isWinner={m.winner === "top"} score={m.topScore} />
    <div className="border-t border-border" />
    <BracketSlot slot={m.bot} isWinner={m.winner === "bot"} score={m.botScore} />
  </div>
);

const BracketSlot = ({
  slot,
  isWinner,
  score,
}: {
  slot: BracketMatch["top"];
  isWinner?: boolean;
  score?: number;
}) => (
  <div
    className={cn(
      "flex items-center justify-between gap-2 px-2 py-1.5",
      isWinner && "bg-primary/10"
    )}
  >
    {slot.team ? (
      <>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">{slot.team.flag}</span>
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-widest truncate",
              isWinner ? "text-primary font-bold" : "text-foreground/80"
            )}
          >
            {slot.team.code}
          </span>
        </div>
        <span
          className={cn(
            "font-semibold text-sm tabular-nums",
            isWinner ? "text-primary" : "text-muted-foreground"
          )}
        >
          {score ?? "—"}
        </span>
      </>
    ) : (
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 italic truncate">
        {slot.placeholder}
      </span>
    )}
  </div>
);

/* ---------------- Leaderboard ---------------- */

const LeaderboardView = () => {
  const max = PLAYERS[0].points;
  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[28px_1fr_56px_42px_50px] gap-2 px-3 py-2 border-b border-border bg-secondary/40 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <div>#</div>
        <div>Player</div>
        <div className="text-right">Picks</div>
        <div className="text-center">Trend</div>
        <div className="text-right">Pts</div>
      </div>
      {PLAYERS.map((p, i) => {
        const pct = (p.points / max) * 100;
        return (
          <div
            key={p.id}
            className="relative grid grid-cols-[28px_1fr_56px_42px_50px] items-center gap-2 px-3 py-2.5 border-b border-border last:border-0"
          >
            <div
              className="absolute inset-y-0 left-0 bg-primary/5 pointer-events-none"
              style={{ width: `${pct}%` }}
            />
            <div
              className={cn(
                "relative font-semibold text-base tabular-nums",
                i === 0 && "text-primary",
                i > 2 && "text-muted-foreground"
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="relative flex items-center gap-2 min-w-0">
              <div className="text-xl shrink-0">{p.avatar}</div>
              <div className="min-w-0">
                <div className="font-semibold text-sm leading-none truncate">{p.name}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5 truncate">
                  {p.handle} · {p.pickToWin.flag} {p.pickToWin.code}
                </div>
              </div>
            </div>
            <div className="relative text-right font-mono text-xs">
              <span className="text-primary font-bold">{p.correctPicks}</span>
              <span className="text-muted-foreground">/{p.totalPicks}</span>
            </div>
            <div className="relative flex items-center justify-center">
              {p.trend > 0 && (
                <span className="flex items-center gap-0.5 text-primary font-mono text-[10px] font-bold">
                  <TrendingUp className="h-3 w-3" />
                  {p.trend}
                </span>
              )}
              {p.trend < 0 && (
                <span className="flex items-center gap-0.5 text-destructive font-mono text-[10px] font-bold">
                  <TrendingDown className="h-3 w-3" />
                  {Math.abs(p.trend)}
                </span>
              )}
              {p.trend === 0 && <Minus className="h-3 w-3 text-muted-foreground" />}
            </div>
            <div className="relative text-right font-semibold text-base tabular-nums">
              {p.points}
            </div>
          </div>
        );
      })}
    </div>
  );
};
