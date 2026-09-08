/**
 * Compatibility owner identity. Firestore/server authorization also accepts
 * a Firebase custom `admin` claim; email checks in the client are UX only.
 */
export const ADMIN_EMAIL = "erkaa130@gmail.com";

export type AdminTokenClaims = Record<string, unknown> | null | undefined;

export function hasAdminClaim(claims: AdminTokenClaims): boolean {
  return claims?.["admin"] === true;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}

export function isAdminIdentity(
  email: string | null | undefined,
  claims?: AdminTokenClaims,
): boolean {
  return hasAdminClaim(claims) || isAdminEmail(email);
}
