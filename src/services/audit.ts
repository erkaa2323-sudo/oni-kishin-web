/**
 * Audit seam. Every admin mutation writes through recordAuditEvent —
 * one centralized pathway. Rows are append-only (no update/delete policy)
 * and readable only by staff. No fake history is ever generated.
 */

import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseDb } from "@/integrations/firebase/client";
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
    const ref = await addDoc(collection(firebaseDb, "auditLogs"), {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      target: input.target ?? null,
      severity: input.severity,
      result: input.result,
      detail: input.detail ?? null,
      createdAt: serverTimestamp(),
    });
    return ok({ id: ref.id });
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

export async function listAuditEvents(limitTo = 100): Promise<ServiceResult<AuditRecord[]>> {
  try {
    const snapshot = await getDocs(
      query(collection(firebaseDb, "auditLogs"), orderBy("createdAt", "desc"), limit(limitTo)),
    );
    const rows = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as Record<
      string,
      unknown
    >[];
    return ok(
      rows.map((r) => ({
        id: String(r["id"] ?? ""),
        createdAt:
          r["createdAt"] && typeof r["createdAt"] === "object" && "toDate" in r["createdAt"]
            ? (r["createdAt"] as { toDate: () => Date }).toDate().toISOString()
            : undefined,
        actorId: String(r["actorId"] ?? ""),
        actorRole: (r["actorRole"] as AuditRecord["actorRole"]) ?? "unknown",
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
