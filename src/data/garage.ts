import car01 from "@/assets/garage/car-01.webp";
import car02 from "@/assets/garage/car-02.webp";
import car03 from "@/assets/garage/car-03.webp";

/**
 * GARAGE vehicle data boundary.
 *
 * Live source: the legacy ONI Firestore `garage` collection, read through the
 * public projection (published vehicles only).
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
  id: string;
  name: string;
  kana?: string;
  ownerCallsign: string;
  categoryId: VehicleCategoryId;
  buildStage?: BuildStage;
  summary: string;
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

/** Allow remote, same-origin relative and legacy raster data URLs; SVG stays blocked. */
export function safeImageUrl(value: string | undefined | null): string | undefined {
  const v = (value ?? "").trim();
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  if (/^\/(?!\/)[^\s]+$/.test(v)) return v;
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(v)) return v;
  return undefined;
}

export type GarageLoad = { status: "ok"; rows: Vehicle[] } | { status: "error"; reason: string };

const GARAGE_ART = [car01, car02, car03];

export function fallbackGarageArt(key: string): string {
  const hash = Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return GARAGE_ART[Math.abs(hash) % GARAGE_ART.length]!;
}

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
      image: safeImageUrl(v.imagePath) ?? fallbackGarageArt(`${v.id}:${v.model}`),
      specs,
    };
  });

  return { status: "ok", rows };
}
