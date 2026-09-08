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

/** Centralized, reusable permission check. */
export function hasPermission(profile: AdminProfile | null, permission: AdminPermission): boolean {
  if (!isAuthorizedAdmin(profile) || !profile) return false;
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
