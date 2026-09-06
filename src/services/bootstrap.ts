/**
 * One-time first-owner bootstrap.
 *
 * The client can only ASK whether an owner exists and REQUEST the owner role
 * for the currently authenticated user. Granting happens inside a database
 * function that refuses once any owner exists (enforced by a unique index),
 * so this path can never produce a second owner and never touches RLS.
 */

export async function ownerExists(): Promise<boolean> {
  // The legacy Firebase owner account already exists. Fail closed and never
  // expose a public self-registration path.
  return true;
}

export type ClaimOutcome = "granted" | "already_bootstrapped" | "unauthenticated" | "error";

export async function claimFirstOwner(): Promise<ClaimOutcome> {
  return "already_bootstrapped";
}

export type SignUpOutcome = { ok: true; hasSession: boolean } | { ok: false; message: string };

/** Legacy Firebase owner already exists, so public admin signup stays disabled. */
export async function signUpFirstOwner(email: string, password: string): Promise<SignUpOutcome> {
  void email;
  void password;
  return { ok: false, message: "OWNER бүртгэл аль хэдийн үүссэн байна." };
}
