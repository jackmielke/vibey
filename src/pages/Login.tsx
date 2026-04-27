import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import vibeySplash from "@/assets/vibey-splash.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { session, isAdmin, checkingAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || checkingAdmin) return;
    if (session && isAdmin) navigate("/", { replace: true });
  }, [session, isAdmin, checkingAdmin, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) {
      toast({ title: "Couldn't send link", description: error.message, variant: "destructive" });
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-safe-screen flex items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-8">
        <img
          src={vibeySplash}
          alt="Vibey"
          className="w-48 h-48 object-contain animate-fade-in"
        />

        <div className="space-y-2">
          <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Vibey Admin
          </h1>
          <p className="text-2xl font-light leading-tight">
            A control panel for the<br />community AI agent.
          </p>
        </div>

        {sent ? (
          <div className="w-full p-6 border border-border rounded-sm space-y-3 animate-fade-in">
            <p className="text-label">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <span className="text-foreground">{email}</span>.
              Click it to sign in.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-xs"
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-3">
            <Input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
              className="h-11"
            />
            <Button type="submit" disabled={sending} className="w-full h-11">
              {sending ? "Sending…" : "Send magic link"}
            </Button>
            <p className="text-xs text-muted-foreground pt-2">
              Admin access only. Your email must be a community admin.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
