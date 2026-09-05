/**
 * Audit seam. Every admin mutation writes through recordAuditEvent —
 * one centralized pathway. Rows are append-only (no update/delete policy)
 * and readable only by staff. No fake history is ever generated.
 */

import { supabase } from "@/integrations/supabase/client";
import { fail, normalizeError, ok, type ServiceResult } from "@/lib/backend/errors";
import type { AdminRole } from "@/data/admin";

export type AuditSeverity = "info" | "warning" | "critical";
export type AuditOutcome = "success" | "failure" | "denied";

export type AuditRecord = {
  id: string;
  createdAt?: string | undefined;
  actorId: string;
  actorRole: AdminRole | "unknown";
  action: string;
  target?: string | undefined;
  severity: AuditSeverity;
  result: AuditOutcome;
  detail?: string | undefined;
};

export type AuditInput = {
  actorId: string;
  actorRole: AdminRole | "unknown";
  action: string;
  target?: string | undefined;
  severity: AuditSeverity;
  result: AuditOutcome;
  detail?: string | undefined;
};

export async function recordAuditEvent(input: AuditInput): Promise<ServiceResult<{ id: string }>> {
  if (!input.actorId) return fail("unauthenticated");
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .insert({
        actor_id: input.actorId,
        actor_role: input.actorRole,
        action: input.action,
        target: input.target ?? null,
        severity: input.severity,
        result: input.result,
        detail: input.detail ?? null,
      } as never)
      .select("id")
      .single();
    if (error) return { ok: false, error: normalizeError(error) };
    return ok({ id: (data as { id: string }).id });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

export async function listAuditEvents(limitTo = 100): Promise<ServiceResult<AuditRecord[]>> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limitTo);
    if (error) return { ok: false, error: normalizeError(error) };
    const rows = (data ?? []) as Record<string, unknown>[];
    return ok(
      rows.map((r) => ({
        id: String(r["id"] ?? ""),
        createdAt: typeof r["created_at"] === "string" ? r["created_at"] : undefined,
        actorId: String(r["actor_id"] ?? ""),
        actorRole: (r["actor_role"] as AuditRecord["actorRole"]) ?? "unknown",
        action: String(r["action"] ?? ""),
        target: typeof r["target"] === "string" ? r["target"] : undefined,
        severity: (r["severity"] as AuditSeverity) ?? "info",
        result: (r["result"] as AuditOutcome) ?? "success",
        detail: typeof r["detail"] === "string" ? r["detail"] : undefined,
      })),
    );
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}
