/** Normalized backend error/result envelope shared by every ONI service. */

export type ServiceErrorCode =
  | "not_configured"
  | "unauthenticated"
  | "unauthorized"
  | "not_found"
  | "invalid"
  | "network"
  | "unknown";

export type ServiceError = { code: ServiceErrorCode; message: string };

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

export const MSG: Record<ServiceErrorCode, string> = {
  not_configured: "Backend тохируулагдаагүй байна. Тохиргоо шаардлагатай.",
  unauthenticated: "Нэвтрээгүй байна.",
  unauthorized: "Энэ үйлдэлд эрх хүрэхгүй байна.",
  not_found: "Бичлэг олдсонгүй.",
  invalid: "Оруулсан мэдээлэл буруу байна.",
  network: "Сүлжээний алдаа гарлаа.",
  unknown: "Тодорхойгүй алдаа гарлаа.",
};

export function fail<T = never>(code: ServiceErrorCode, message?: string): ServiceResult<T> {
  return { ok: false, error: { code, message: message ?? MSG[code] } };
}

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

/** Map a raw Supabase/PostgREST/unknown throw into a normalized ServiceError. */
export function normalizeError(err: unknown): ServiceError {
  const e = (err ?? {}) as { code?: string; message?: string; status?: number };
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message : "";

  if (code === "42501" || /permission denied|row-level security/i.test(message))
    return { code: "unauthorized", message: MSG.unauthorized };
  if (code === "PGRST301" || e.status === 401)
    return { code: "unauthenticated", message: MSG.unauthenticated };
  if (code === "PGRST116") return { code: "not_found", message: MSG.not_found };
  if (code.startsWith("22") || code.startsWith("23") || /invalid|violates check/i.test(message))
    return { code: "invalid", message: MSG.invalid };
  if (/fetch|network|timeout/i.test(message)) return { code: "network", message: MSG.network };

  return { code: "unknown", message: MSG.unknown };
}
