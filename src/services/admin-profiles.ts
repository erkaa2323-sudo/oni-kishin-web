/**
 * Authorization (separate from authentication).
 *
 * A signed-in user is NOT an admin. Authority lives in the `user_roles`
 * table, which only an owner may write (enforced by RLS). Nothing here can
 * self-promote, and a failed lookup fails closed.
 */

import { supabase } from "@/integrations/supabase/client";
import { fail, normalizeError, ok, type ServiceResult } from "@/lib/backend/errors";
import { ROLE_PERMISSIONS, type AdminPermission, type AdminRole } from "@/data/admin";

export type AdminProfile = {
  uid: string;
  email?: string | undefined;
  displayName?: string | undefined;
  role: AdminRole;
};

const VALID_ROLES: AdminRole[] = ["owner", "admin", "moderator"];
const RANK: Record<AdminRole, number> = { owner: 3, admin: 2, moderator: 1 };

export function isValidRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (VALID_ROLES as string[]).includes(value);
}

/** Centralized, reusable permission check. */
export function hasPermission(profile: AdminProfile | null, permission: AdminPermission): boolean {
  if (!profile) return false;
  return ROLE_PERMISSIONS[profile.role]?.includes(permission) ?? false;
}

export function isAuthorizedAdmin(profile: AdminProfile | null): boolean {
  return !!profile && isValidRole(profile.role);
}

/**
 * Read the caller's own authorization. No role row = not authorized.
 * Any error is treated as "not authorized" (fail closed).
 */
export async function fetchAdminProfile(
  uid: string,
  email?: string | null,
): Promise<ServiceResult<AdminProfile>> {
  try {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (error) return { ok: false, error: normalizeError(error) };

    const roles = (data ?? [])
      .map((r) => (r as { role: string }).role)
      .filter(isValidRole) as AdminRole[];
    if (!roles.length) return fail("unauthorized");

    const role = roles.sort((a, b) => RANK[b] - RANK[a])[0]!;

    let displayName: string | undefined;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", uid)
      .maybeSingle();
    if (profile && typeof (profile as { display_name?: string }).display_name === "string") {
      displayName = (profile as { display_name?: string }).display_name;
    }

    return ok({ uid, email: email ?? undefined, displayName, role });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}
