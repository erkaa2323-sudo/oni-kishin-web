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
  kishinArrival: boolean;
  entranceMs: number;
  intensity: number;
};

const IMPLEMENTED_FX = new Set<OniFxId>([
  "frame-crimson",
  "aura-red-moon",
  "entrance-kishin",
]);

export function isImplementedOniFx(id: string): id is OniFxId {
  return IMPLEMENTED_FX.has(id as OniFxId);
}

export function resolveOniFx(effectIds: readonly string[]): OniFxResolved {
  const set = new Set(effectIds.filter(isImplementedOniFx));
  const crimsonFrame = set.has("frame-crimson");
  const redMoon = set.has("aura-red-moon");
  const kishinArrival = set.has("entrance-kishin");
  const active = crimsonFrame || redMoon || kishinArrival;
  const stacked = Number(crimsonFrame) + Number(redMoon) + Number(kishinArrival);

  return {
    active,
    crimsonFrame,
    redMoon,
    kishinArrival,
    entranceMs: kishinArrival ? 1400 : 0,
    intensity: active ? Math.min(1.08, 0.86 + stacked * 0.07) : 0,
  };
}
