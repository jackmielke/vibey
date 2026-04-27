import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import vibeySplash from "@/assets/vibey-splash.png";
import { Mail, KeyRound, Loader2, ArrowLeft } from "lucide-react";

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
      {/* Left visual panel — hidden on mobile */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-secondary border-r border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,hsl(var(--primary)/0.08),transparent_50%)]" />

        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Vibey · Admin Console
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <img
              src={vibeySplash}
              alt=""
              className="w-full max-w-md object-contain drop-shadow-2xl animate-fade-in"
            />
          </div>

          <div className="space-y-3 max-w-md">
            <h2 className="text-3xl font-light leading-tight tracking-tight">
              The control panel for your community's AI agent.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Curate memories. Tune behavior. Watch every conversation.
              All from one place.
            </p>
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
