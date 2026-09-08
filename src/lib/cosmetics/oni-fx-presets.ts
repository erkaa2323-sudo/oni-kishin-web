export type OniFxId =
  | "frame-crimson"
  | "aura-red-moon"
  | "garage-neon"
  | "shizuki-kitsune"
  | "title-night-rider"
  | "entrance-kishin"
  | "creator-red-moon"
  | "trophy-vault";

export type OniFxResolved = {
  active: boolean;
  crimsonFrame: boolean;
  redMoon: boolean;
  garageNeon: boolean;
  kitsune: boolean;
  nightRider: boolean;
  kishinArrival: boolean;
  creatorMoon: boolean;
  trophyVault: boolean;
  entranceMs: number;
  intensity: number;
};

export const ONI_IMPLEMENTED_FX = [
  "frame-crimson",
  "aura-red-moon",
  "garage-neon",
  "shizuki-kitsune",
  "title-night-rider",
  "entrance-kishin",
  "creator-red-moon",
  "trophy-vault",
] as const satisfies readonly OniFxId[];

const IMPLEMENTED_FX = new Set<OniFxId>(ONI_IMPLEMENTED_FX);

export function isImplementedOniFx(id: string): id is OniFxId {
  return IMPLEMENTED_FX.has(id as OniFxId);
}

export function resolveOniFx(effectIds: readonly string[]): OniFxResolved {
  const set = new Set(effectIds.filter(isImplementedOniFx));
  const crimsonFrame = set.has("frame-crimson");
  const redMoon = set.has("aura-red-moon");
  const garageNeon = set.has("garage-neon");
  const kitsune = set.has("shizuki-kitsune");
  const nightRider = set.has("title-night-rider");
  const kishinArrival = set.has("entrance-kishin");
  const creatorMoon = set.has("creator-red-moon");
  const trophyVault = set.has("trophy-vault");
  const active = set.size > 0;

  return {
    active,
    crimsonFrame,
    redMoon,
    garageNeon,
    kitsune,
    nightRider,
    kishinArrival,
    creatorMoon,
    trophyVault,
    entranceMs: kishinArrival ? 1400 : 0,
    intensity: active ? Math.min(1.08, 0.82 + set.size * 0.045) : 0,
  };
}
