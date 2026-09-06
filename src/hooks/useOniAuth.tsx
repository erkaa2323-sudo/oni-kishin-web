/**
 * ONI admin session: Firebase authentication plus an explicit owner allowlist.
 * Authentication alone grants nothing.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { firebaseAuth } from "@/integrations/firebase/client";
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
 * Firebase configuration is bundled in the legacy ONI client module.
 * Any runtime initialization failure still fails closed.
 */
const backendConfigured = true;

/** Truthful, non-leaking Mongolian messages for the auth failures we can hit. */
function describeAuthError(message: string): string {
  if (/invalid-credential|wrong-password|user-not-found|invalid login credentials/i.test(message))
    return "И-мэйл эсвэл нууц үг буруу байна.";
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

    const resolve = async (user: { uid: string; email?: string | null } | null) => {
      if (!active) return;
      if (!user) {
        setUid(null);
        setEmail(null);
        setProfile(null);
        setPhase("signed_out");
        return;
      }
      setUid(user.uid);
      setEmail(user.email ?? null);
      setPhase("loading");
      const res = await fetchAdminProfile(user.uid, user.email ?? null);
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

    try {
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => void resolve(user));
      return () => {
        active = false;
        unsubscribe();
      };
    } catch {
      setError("Backend client could not be initialized.");
      setPhase("backend_unavailable");
    }

    return () => {
      active = false;
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
      await signInWithEmailAndPassword(firebaseAuth, mail.trim(), password);
    } catch (err) {
      setError(describeAuthError(err instanceof Error ? err.message : String(err)));
      setPhase("signed_out");
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth);
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
