/**
 * GARAGE vehicle data boundary.
 *
 * Live source: the `garage_vehicles` table in Lovable Cloud, read through the
 * public projection allowed by row-level security (published vehicles only).
 * No image URLs are invented — a record without an image renders the explicit
 * "no image" fallback.
 */

export type VehicleCategoryId = "drift" | "street" | "track";

export type VehicleCategory = {
  id: VehicleCategoryId;
  label: string;
  code: string;
};

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  { id: "drift", label: "ДРИФТ", code: "DRIFT" },
  { id: "street", label: "ГУДАМЖ", code: "STREET" },
  { id: "track", label: "ТРЕК", code: "TRACK" },
];

export type BuildStage = "stage1" | "stage2" | "stage3";

export const BUILD_STAGE_LABEL: Record<BuildStage, string> = {
  stage1: "1-Р ҮЕ",
  stage2: "2-Р ҮЕ",
  stage3: "3-Р ҮЕ",
};

export type Vehicle = {
  /** Database row id */
  id: string;
  name: string;
  kana?: string;
  /** Owner callsign as stored on the record (may be unknown) */
  ownerCallsign: string;
  categoryId: VehicleCategoryId;
  /** Undefined when the record does not declare a build stage. */
  buildStage?: BuildStage;
  summary: string;
  /** Image URL from the record. Absent → explicit fallback in the UI. */
  image?: string;
  specs: { label: string; value: string }[];
};

export function parseCategory(value: string | undefined | null): VehicleCategoryId {
  const v = (value ?? "").toLowerCase();
  if (v.includes("drift") || v.includes("дрифт")) return "drift";
  if (v.includes("track") || v.includes("трек")) return "track";
  return "street";
}

export function parseBuildStage(value: string | undefined | null): BuildStage | undefined {
  const v = (value ?? "").toLowerCase();
  if (v.includes("stage3") || v.includes("3")) return "stage3";
  if (v.includes("stage2") || v.includes("2")) return "stage2";
  if (v.includes("stage1") || v.includes("1")) return "stage1";
  return undefined;
}

/** Only http(s) image URLs are rendered; anything else is ignored. */
export function safeImageUrl(value: string | undefined | null): string | undefined {
  const v = (value ?? "").trim();
  return /^https?:\/\/\S+$/i.test(v) ? v : undefined;
}

export type GarageLoad = { status: "ok"; rows: Vehicle[] } | { status: "error"; reason: string };

export async function fetchVehicles(): Promise<GarageLoad> {
  const { garageService } = await import("@/services/domains");
  const res = await garageService.listPublished();
  if (!res.ok) return { status: "error", reason: res.error.message };

  const rows: Vehicle[] = res.data.map((v) => {
    const categoryId = parseCategory(v.category);
    const buildStage = parseBuildStage(v.build);
    const specs: { label: string; value: string }[] = [
      { label: "АНГИЛАЛ", value: VEHICLE_CATEGORIES.find((c) => c.id === categoryId)!.label },
    ];
    if (v.build) specs.push({ label: "БҮТЭЦ", value: v.build });
    if (v.ownerName) specs.push({ label: "ЭЗЭН", value: v.ownerName });

    return {
      id: v.id,
      name: v.model,
      ownerCallsign: v.ownerName ?? "—",
      categoryId,
      ...(buildStage ? { buildStage } : {}),
      summary: v.build ?? "",
      ...(safeImageUrl(v.imagePath) ? { image: safeImageUrl(v.imagePath)! } : {}),
      specs,
    };
  });

  return { status: "ok", rows };
}
