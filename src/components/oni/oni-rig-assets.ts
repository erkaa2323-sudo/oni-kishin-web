import type { OniRigLayerId } from "./oni-rig-manifest";

const modules = import.meta.glob("../../assets/oni-rig/*.{png,webp}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const FILE_BY_LAYER: Record<OniRigLayerId, string> = {
  hairBack: "hair-back",
  body: "body",
  torso: "torso",
  armLeft: "arm-left",
  armRight: "arm-right",
  face: "face-base",
  eyeLeft: "eye-left",
  eyeRight: "eye-right",
  pupilLeft: "pupil-left",
  pupilRight: "pupil-right",
  mouth: "mouth-neutral",
  hornLeft: "horn-left",
  hornRight: "horn-right",
  hairFront: "hair-front",
  hairSideLeft: "hair-side-left",
  hairSideRight: "hair-side-right",
  accessories: "accessories",
};

function normalizePath(path: string) {
  return path.split("/").pop()?.replace(/\.(png|webp)$/i, "") ?? "";
}

const urlByBaseName = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) {
  urlByBaseName.set(normalizePath(path), url);
}

export function getOniRigAsset(layerId: OniRigLayerId): string | undefined {
  return urlByBaseName.get(FILE_BY_LAYER[layerId]);
}

export function getOniRigAssetCoverage() {
  const entries = Object.entries(FILE_BY_LAYER) as Array<[OniRigLayerId, string]>;
  const available = entries.filter(([, file]) => urlByBaseName.has(file)).map(([id]) => id);
  return {
    total: entries.length,
    available,
    complete: available.length === entries.length,
  };
}
