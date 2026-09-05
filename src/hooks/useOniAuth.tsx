/**
 * ONI admin session: authentication (Lovable Cloud auth) + authorization
 * (user_roles). Authentication alone grants nothing.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  fetchAdminProfile,
  hasPermission as checkPermission,
  isAuthorizedAdmin,
  type AdminProfile,
} from "@/services/admin-profiles";
import type { AdminPermission } from "@/data/admin";

export type AdminAuthPhase =
  "loading" | "signed_out" | "unauthorized" | "authorized" | "backend_unavailable";

export type OniAuthState = {
  phase: AdminAuthPhase;
  uid: string | null;
  email: string | null;
  profile: AdminProfile | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (p: AdminPermission) => boolean;
};

const AuthContext = createContext<OniAuthState | null>(null);

/**
 * Backend availability = the generated Supabase client can initialize.
 * The client itself falls back from VITE_* build-time vars to SSR env, so a
 * stricter build-time-only check would wrongly reject valid deployments.
 * Fail-closed: any initialization failure is treated as unavailable.
 */
const backendConfigured = (() => {
  try {
    void supabase.auth;
    return true;
  } catch {
    return false;
  }
})();

/** Truthful, non-leaking Mongolian messages for the auth failures we can hit. */
function describeAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "И-мэйл эсвэл нууц үг буруу байна.";
  if (/email not confirmed/i.test(message))
    return "И-мэйл хаяг баталгаажаагүй байна. Бүртгэлийн и-мэйл дэх баталгаажуулах холбоосыг дарж, дараа нь дахин нэвтэрнэ үү.";
  if (/rate limit|too many/i.test(message))
    return "Хэт олон оролдлого хийсэн байна. Хэсэг хүлээгээд дахин оролдоно уу.";
  if (/failed to fetch|network/i.test(message))
    return "Сүлжээний алдаа. Холболтоо шалгаад дахин оролдоно уу.";
  return "Нэвтрэх боломжгүй байна. Дахин оролдоно уу.";
}

export function OniAuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AdminAuthPhase>("loading");
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!backendConfigured) {
      setError("Backend configuration is unavailable in this deployment.");
      setPhase("backend_unavailable");
      return () => {
        active = false;
      };
    }

    const resolve = async (user: { id: string; email?: string | null } | null) => {
      if (!active) return;
      if (!user) {
        setUid(null);
        setEmail(null);
        setProfile(null);
        setPhase("signed_out");
        return;
      }
      setUid(user.id);
      setEmail(user.email ?? null);
      setPhase("loading");
      const res = await fetchAdminProfile(user.id, user.email ?? null);
      if (!active) return;
      if (res.ok && isAuthorizedAdmin(res.data)) {
        setProfile(res.data);
        setPhase("authorized");
      } else {
        // Fail closed: any lookup failure is treated as no authority.
        setProfile(null);
        setPhase("unauthorized");
      }
    };

    let unsubscribe: (() => void) | undefined;
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        void resolve(session?.user ?? null);
      });
      unsubscribe = () => sub.subscription.unsubscribe();

      void supabase.auth
        .getSession()
        .then(({ data }) => {
          void resolve(data.session?.user ?? null);
        })
        .catch(() => {
          if (!active) return;
          setError("Backend session could not be initialized.");
          setPhase("backend_unavailable");
        });
    } catch {
      setError("Backend client could not be initialized.");
      setPhase("backend_unavailable");
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (mail: string, password: string) => {
    setError(null);
    if (!backendConfigured) {
      setError("Backend configuration is unavailable in this deployment.");
      setPhase("backend_unavailable");
      return;
    }
    setPhase("loading");
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: mail.trim(),
        password,
      });
      if (err) {
        setPhase("signed_out");
        setError(describeAuthError(err.message));
      }
    } catch {
      setError("Backend client could not be initialized.");
      setPhase("backend_unavailable");
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUid(null);
    setEmail(null);
    setPhase("signed_out");
  }, []);

  const value = useMemo<OniAuthState>(
    () => ({
      phase,
      uid,
      email,
      profile,
      error,
      signIn,
      signOut,
      hasPermission: (p) => checkPermission(profile, p),
    }),
    [phase, uid, email, profile, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useOniAuth(): OniAuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useOniAuth must be used inside <OniAuthProvider>");
  return ctx;
}
