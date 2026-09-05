/**
 * One-time first-owner bootstrap.
 *
 * The client can only ASK whether an owner exists and REQUEST the owner role
 * for the currently authenticated user. Granting happens inside a database
 * function that refuses once any owner exists (enforced by a unique index),
 * so this path can never produce a second owner and never touches RLS.
 */

import { supabase } from "@/integrations/supabase/client";

export async function ownerExists(): Promise<boolean> {
  const { data, error } = await supabase.rpc("owner_exists");
  // Fail closed: if we cannot verify, assume an owner exists and hide bootstrap.
  if (error) return true;
  return data === true;
}

export type ClaimOutcome = "granted" | "already_bootstrapped" | "unauthenticated" | "error";

export async function claimFirstOwner(): Promise<ClaimOutcome> {
  const { data, error } = await supabase.rpc("claim_first_owner");
  if (error) return "error";
  if (data === "granted" || data === "already_bootstrapped" || data === "unauthenticated") {
    return data;
  }
  return "error";
}

export type SignUpOutcome = { ok: true; hasSession: boolean } | { ok: false; message: string };

/** Standard Supabase email/password signup — no credentials are stored anywhere. */
export async function signUpFirstOwner(email: string, password: string): Promise<SignUpOutcome> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${window.location.origin}/admin` },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { ok: false, message: "Энэ и-мэйл аль хэдийн бүртгэлтэй байна. Нэвтэрч орно уу." };
    }
    if (/password/i.test(error.message)) {
      return { ok: false, message: "Нууц үг шаардлага хангахгүй байна (6+ тэмдэгт)." };
    }
    return { ok: false, message: "Бүртгэл үүсгэж чадсангүй. Дахин оролдоно уу." };
  }
  return { ok: true, hasSession: !!data.session };
}
