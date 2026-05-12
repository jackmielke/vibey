import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ADMIN_CHECK_TIMEOUT_MS = 12000;
const SESSION_RESTORE_TIMEOUT_MS = 6000;

function withTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  timeoutMs = ADMIN_CHECK_TIMEOUT_MS
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  checkingAdmin: boolean;
  authError: string | null;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setAuthError(null);
      setSession(newSession);
      setLoading(false);
    });

    // Then fetch existing session
    withTimeout(
      supabase.auth.getSession(),
      "Session restore",
      SESSION_RESTORE_TIMEOUT_MS
    )
      .then(({ data }) => {
        setAuthError(null);
        setSession(data.session);
      })
      .catch((error) => {
        console.error("Failed to restore Supabase session", error);
        setAuthError("Couldn't restore your session. Please refresh and sign in again.");
        setSession(null);
      })
      .finally(() => setLoading(false));

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setAuthError(null);
      setCheckingAdmin(false);
      return;
    }
    let cancelled = false;
    setCheckingAdmin(true);
    setAuthError(null);

    (async () => {
      try {
        // Find users.id from auth_user_id, then check community_members.role = 'admin'
        const { data: userRow, error: userError } = await withTimeout(
          supabase
            .from("users")
            .select("id")
            .eq("auth_user_id", userId)
            .maybeSingle(),
          "Admin user lookup"
        );

        if (userError) throw userError;

        if (!userRow) {
          if (!cancelled) {
            setIsAdmin(false);
          }
          return;
        }

        const { data: member, error: memberError } = await withTimeout(
          supabase
            .from("community_members")
            .select("role")
            .eq("community_id", VIBEY_COMMUNITY_ID)
            .eq("user_id", userRow.id)
            .eq("role", "admin")
            .maybeSingle(),
          "Admin role lookup"
        );

        if (memberError) throw memberError;

        if (!cancelled) {
          setIsAdmin(!!member);
        }
      } catch (error) {
        console.error("Failed to verify admin access", error);
        if (!cancelled) {
          setIsAdmin(false);
          setAuthError("Couldn't verify admin access. Please check your connection and try again.");
        }
      } finally {
        if (!cancelled) {
          setCheckingAdmin(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    session,
    user: session?.user ?? null,
    loading,
    isAdmin,
    checkingAdmin,
    authError,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}
