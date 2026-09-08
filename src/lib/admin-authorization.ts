/** Canonical Firebase owner allowlist; mirrored by Firestore isAdmin().
 * Client checks are UX only. Firestore and verified server tokens enforce access.
 */
export const ADMIN_EMAIL = "erkaa130@gmail.com";
export function isAdminEmail(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}
