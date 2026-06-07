import { useState } from "react";
import { Trophy, Coins, DollarSign, ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import mascotAsset from "@/assets/golden-goal-mascot.png.asset.json";

// Conversion: $100 USD = 1,000,000 Vibe Coin → 1 VIBE = $0.0001
const USD_BUY_IN = 100;
const VIBE_BUY_IN = 1_000_000;
const VIBE_PER_USD = VIBE_BUY_IN / USD_BUY_IN; // 10,000

export default function GoldenGoalLanding() {
  const [pay, setPay] = useState<"usd" | "vibe">("usd");

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">
              Golden Goal · by Vibey
            </span>
          </a>
          <nav className="hidden sm:flex items-center gap-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#price" className="hover:text-foreground">Buy-in</a>
            <a href="/mini" className="hover:text-foreground">Open app</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-10 pb-16 grid md:grid-cols-2 gap-10 items-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
            World Cup · for your group chat
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Run the World Cup
            <br />
            <span className="text-primary">in your group chat.</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-md">
            Brackets, score predictions, leaderboards, live trash talk — all powered by
            Vibey, your community agent. One buy-in, one champion, all summer.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="#price"
              className="inline-flex items-center gap-2 rounded border border-primary bg-primary px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Join the pool <ArrowRight className="h-3 w-3" />
            </a>
            <a
              href="/mini"
              className="inline-flex items-center gap-2 rounded border border-border bg-secondary/40 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-foreground hover:border-primary/50 transition-colors"
            >
              See the app
            </a>
          </div>
          <div className="flex items-center gap-5 pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> 32 teams</span>
            <span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> Live scores</span>
            <span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> Winner takes pot</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent blur-3xl -z-10" />
          <img
            src={mascotAsset.url}
            alt="Vibey hoisting the World Cup trophy as a low-poly FIFA referee mascot"
            className="w-full h-auto rounded-lg border border-border shadow-2xl"
            loading="eager"
          />
        </motion.div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border bg-secondary/20">
        <div className="max-w-6xl mx-auto px-5 py-14">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">
            Three steps. One champion.
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              { n: "01", t: "Buy in", d: "$100 USD or 1,000,000 Vibe Coin. Pot grows with every player." },
              { n: "02", t: "Pick & predict", d: "Fill your bracket, score-predict every match. 3pts winner, +5 exact score." },
              { n: "03", t: "Winner takes pot", d: "Top of the leaderboard at the Final whistle takes it all." },
            ].map((s) => (
              <article key={s.n} className="rounded border border-border bg-card p-5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  {s.n}
                </div>
                <h3 className="font-semibold text-lg mt-2">{s.t}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{s.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="price" className="max-w-6xl mx-auto px-5 py-16">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
            Buy-in
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            One price, two ways to pay.
          </h2>
          <p className="text-sm text-muted-foreground">
            Locked at <span className="font-mono text-foreground">1 VIBE = $0.0001 USD</span>.
            Pay however your group rolls.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-9 max-w-3xl mx-auto">
          <PayCard
            active={pay === "usd"}
            onClick={() => setPay("usd")}
            icon={<DollarSign className="h-4 w-4" />}
            label="USD"
            amount="$100"
            sub="per player · one-time"
            note="Stripe, Apple Pay, or bank transfer at checkout."
          />
          <PayCard
            active={pay === "vibe"}
            onClick={() => setPay("vibe")}
            icon={<Coins className="h-4 w-4" />}
            label="Vibe Coin"
            amount="1,000,000"
            sub={`≈ $${USD_BUY_IN} USD · ${VIBE_PER_USD.toLocaleString()} VIBE / $1`}
            note="Burned from your Vibey wallet on entry."
          />
        </div>

        <div className="mt-8 flex justify-center">
          <a
            href="/mini"
            className="inline-flex items-center gap-2 rounded border border-primary bg-primary px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Claim your spot · {pay === "usd" ? "$100" : "1,000,000 VIBE"}
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>© Vibey · Golden Goal 2026</span>
          <span>Built for the Vibe Ventures community</span>
        </div>
      </footer>
    </main>
  );
}

function PayCard({
  active,
  onClick,
  icon,
  label,
  amount,
  sub,
  note,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  amount: string;
  sub: string;
  note: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded border bg-card p-5 transition-all ${
        active
          ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {icon}
          {label}
        </div>
        {active && (
          <span className="rounded-full bg-primary/10 border border-primary/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
            Selected
          </span>
        )}
      </div>
      <div className="mt-3 font-semibold text-3xl tracking-tight tabular-nums">{amount}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
        {sub}
      </div>
      <p className="text-xs text-muted-foreground/80 mt-3 leading-relaxed">{note}</p>
    </button>
  );
}
