import { isAdminEmail } from "@/lib/admin-authorization";
/**
 * Authorization (separate from authentication).
 *
 * A signed-in user is NOT automatically an admin. The legacy Firebase owner
 * account is explicitly allowlisted; nothing here can self-promote, and a
 * failed lookup fails closed.
 */

import { fail, ok, type ServiceResult } from "@/lib/backend/errors";
import { ROLE_PERMISSIONS, type AdminPermission, type AdminRole } from "@/data/admin";

export type AdminProfile = {
  uid: string;
  email?: string | undefined;
  displayName?: string | undefined;
  role: AdminRole;
};

const VALID_ROLES: AdminRole[] = ["owner", "admin", "moderator"];

export function isValidRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (VALID_ROLES as string[]).includes(value);
}

/**
 * Centralized, reusable permission check.
 *
 * The strict auth gate resolves an allowlisted owner profile with email, while
 * several admin action surfaces intentionally pass a compact { uid, role }
 * actor after that gate has already succeeded. Accept that compact owner shape
 * for UI permission checks so review controls do not get disabled/hidden merely
 * because the email field was omitted. Firestore rules and the admin action
 * dispatcher remain the authoritative write boundary.
 */
export function hasPermission(profile: AdminProfile | null, permission: AdminPermission): boolean {
  if (!profile) return false;
  const authorized = profile.email ? isAuthorizedAdmin(profile) : profile.role === "owner";
  if (!authorized) return false;
  return ROLE_PERMISSIONS[profile.role]?.includes(permission) ?? false;
}

export function isAuthorizedAdmin(profile: AdminProfile | null): boolean {
  return !!profile && profile.role === "owner" && isAdminEmail(profile.email);
}

/**
 * Resolve the caller against the existing Firebase owner allowlist.
 * Any error is treated as "not authorized" (fail closed).
 */
export async function fetchAdminProfile(
  uid: string,
  email?: string | null,
): Promise<ServiceResult<AdminProfile>> {
  const normalizedEmail = email ?? "";
  if (!isAdminEmail(normalizedEmail)) return fail("unauthorized");
  return ok({ uid, email: normalizedEmail, displayName: "ONI OWNER", role: "owner" });
}