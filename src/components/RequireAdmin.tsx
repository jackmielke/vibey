import { Navigate } from "react-router-dom";
import { useAuth, signOut } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import vibeySplash from "@/assets/vibey-splash.png";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session, isAdmin, loading, checkingAdmin } = useAuth();

  if (loading || (session && checkingAdmin)) {
    return (
      <div className="min-h-safe-screen flex items-center justify-center bg-background">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-safe-screen flex items-center justify-center px-6 bg-background">
        <div className="w-full max-w-md text-center space-y-6">
          <img src={vibeySplash} alt="Vibey" className="w-32 h-32 mx-auto opacity-60" />
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Access denied
            </p>
            <p className="text-lg">
              <span className="text-foreground">{session.user.email}</span> is not a Vibey admin.
            </p>
            <p className="text-sm text-muted-foreground">
              Ask a community admin to grant you access.
            </p>
          </div>
          <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
