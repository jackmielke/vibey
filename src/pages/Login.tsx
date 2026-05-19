import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import vibeySplash from "@/assets/vibey-splash.png";
import { RobotScene } from "@/components/VibeyRobot";
import { Mail, KeyRound, Loader2, ArrowLeft } from "lucide-react";

const tickerItems = [
  ["INF", "Summarized 'Biotech Futures' workshop for TG group."],
  ["ACT", "Detected high vibe in lounge; queued requested track."],
  ["SYN", "Updated Esmeralda knowledge graph (32 new nodes)."],
  ["NET", "Posted curated thread to @vibey on X."],
  ["OBS", "Listening to 'Decentralized Trust' session, room 04."],
];

type Mode = "password" | "magic";

export default function Login() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const { session, isAdmin, checkingAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || checkingAdmin) return;
    if (session && isAdmin) navigate("/", { replace: true });
  }, [session, isAdmin, checkingAdmin, loading, navigate]);

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setSubmitting(false);
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setSubmitting(false);
    if (error) {
      toast({
        title: "Couldn't send link",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setMagicSent(true);
  };

  return (
    <div className="min-h-safe-screen flex items-stretch bg-background">
      {/* Left landing panel — hidden on mobile */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-spec-bg text-spec-ink font-sans border-r border-spec-line">
        {/* Top status bar */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-3 bg-spec-bg/85 backdrop-blur-md border-b border-spec-line">
          <span className="font-mono font-bold tracking-tighter text-xs uppercase">Vibey v1.0.4</span>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-spec-accent animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-tighter">System: Active</span>
          </div>
        </div>

        {/* Hero */}
        <div className="relative w-full pt-16 pb-0 px-10 xl:px-14 flex flex-col">
          <div className="flex-1 grid grid-cols-12 gap-6 items-center py-6">
            <div className="col-span-12 xl:col-span-5 animate-spec-rise">
              <div className="inline-block px-2 py-1 border border-spec-accent text-spec-accent text-[10px] font-mono mb-5 uppercase tracking-widest">
                Hardware Integrated AI
              </div>
              <h1 className="text-5xl xl:text-6xl font-bold tracking-tighter leading-[0.88] mb-6 uppercase">
                Your AI <br />
                <span className="text-spec-accent">Neighbor</span>
              </h1>
              <p className="text-sm text-spec-muted max-w-[42ch] mb-8 leading-relaxed">
                A community-first agent engineered for Edge Esmeralda. Vibey synthesizes workshop data, manages
                Telegram protocols, and operates physical chassis units. Open-source, by design.
              </p>
              <dl className="grid grid-cols-3 gap-5 max-w-sm font-mono text-[10px] uppercase tracking-widest">
                <div>
                  <dt className="text-spec-muted">Model</dt>
                  <dd className="text-spec-ink mt-1">VBY-1.0.4</dd>
                </div>
                <div>
                  <dt className="text-spec-muted">Origin</dt>
                  <dd className="text-spec-ink mt-1">Esmeralda</dd>
                </div>
                <div>
                  <dt className="text-spec-muted">License</dt>
                  <dd className="text-spec-ink mt-1">MIT</dd>
                </div>
              </dl>
            </div>

            <div className="col-span-12 xl:col-span-7 relative animate-spec-rise [animation-delay:200ms]">
              <div className="relative w-full aspect-[4/5] max-h-[58vh] bg-spec-surface rounded-2xl border border-spec-line shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] overflow-hidden">
                <div className="absolute inset-0 micro-grid pointer-events-none" />
                <RobotScene
                  url="/models/robot-expressive.glb"
                  theme="light"
                  cameraZ={9}
                  scale={0.42}
                  yOffset={-1.0}
                  showControls={false}
                />
                <span className="absolute top-3 left-3 text-[10px] font-mono text-spec-muted uppercase tracking-widest z-10">
                  Component_View_01
                </span>
                <span className="absolute top-3 right-3 text-[10px] font-mono text-spec-accent uppercase tracking-widest z-10">
                  // LIVE
                </span>
              </div>
            </div>
          </div>

          {/* Ticker */}
          <div className="border-y border-spec-line bg-spec-surface/60 py-2 overflow-hidden -mx-10 xl:-mx-14">
            <div className="flex w-max gap-10 whitespace-nowrap animate-spec-marquee font-mono text-[10px]">
              {[...tickerItems, ...tickerItems, ...tickerItems].map(([k, v], i) => (
                <span key={i} className="flex items-center gap-3">
                  <span className="text-spec-accent font-bold">{k}:</span>
                  <span className="text-spec-ink/80">{v}</span>
                  <span className="text-spec-muted/40">//</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 lg:flex-none lg:w-[480px] flex flex-col justify-center px-6 sm:px-12 py-12">
        <div className="w-full max-w-sm mx-auto space-y-8">
          {/* Mobile-only header with splash */}
          <div className="lg:hidden flex flex-col items-center text-center gap-4">
            <img src={vibeySplash} alt="" className="w-32 h-32 object-contain" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Vibey · Admin Console
            </span>
          </div>

          {magicSent ? (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <h1 className="text-2xl font-light tracking-tight">
                  Check your inbox
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We sent a sign-in link to{" "}
                  <span className="text-foreground font-medium">{email}</span>.
                  It expires in 60 minutes.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setMagicSent(false);
                  setMode("password");
                }}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h1 className="text-3xl font-light tracking-tight">
                  Welcome back.
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sign in to your Vibey admin account.
                </p>
              </div>

              {/* Mode toggle */}
              <div className="flex p-1 bg-secondary rounded-sm border border-border">
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-mono uppercase tracking-wider rounded-sm transition-colors ${
                    mode === "password"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <KeyRound className="h-3 w-3" />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setMode("magic")}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-mono uppercase tracking-wider rounded-sm transition-colors ${
                    mode === "magic"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Mail className="h-3 w-3" />
                  Magic link
                </button>
              </div>

              {mode === "password" ? (
                <form onSubmit={handlePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-label">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      autoFocus
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-label">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      className="h-11"
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full h-11">
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Sign in
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleMagic} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-magic" className="text-label">Email</Label>
                    <Input
                      id="email-magic"
                      type="email"
                      required
                      autoFocus
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      className="h-11"
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full h-11">
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Send magic link
                  </Button>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We'll email you a one-tap sign-in link. No password needed.
                  </p>
                </form>
              )}

              <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
                Admin access only. Your email must be a community admin.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
