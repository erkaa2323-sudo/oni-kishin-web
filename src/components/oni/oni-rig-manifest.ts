import type { OniState } from "@/lib/oni-emotion";

export type OniRigLayerId =
  | "hairBack"
  | "body"
  | "torso"
  | "armLeft"
  | "armRight"
  | "face"
  | "eyeLeft"
  | "eyeRight"
  | "pupilLeft"
  | "pupilRight"
  | "mouth"
  | "hornLeft"
  | "hornRight"
  | "hairFront"
  | "hairSideLeft"
  | "hairSideRight"
  | "accessories";

export type OniRigLayer = {
  id: OniRigLayerId;
  src?: string;
  z: number;
  anchorX: number;
  anchorY: number;
  physics?: "head" | "body" | "hair" | "arm" | "face";
};

/**
 * Stable layer contract for ONI Rig v2. Asset paths stay optional until the
 * final transparent character sprites are committed; the runtime therefore
 * remains deployable while art is produced incrementally.
 */
export const ONI_RIG_LAYERS: OniRigLayer[] = [
  { id: "hairBack", z: 10, anchorX: 50, anchorY: 30, physics: "hair" },
  { id: "body", z: 20, anchorX: 50, anchorY: 66, physics: "body" },
  { id: "torso", z: 30, anchorX: 50, anchorY: 58, physics: "body" },
  { id: "armLeft", z: 35, anchorX: 42, anchorY: 58, physics: "arm" },
  { id: "armRight", z: 36, anchorX: 58, anchorY: 58, physics: "arm" },
  { id: "face", z: 40, anchorX: 50, anchorY: 27, physics: "head" },
  { id: "eyeLeft", z: 50, anchorX: 46, anchorY: 27, physics: "face" },
  { id: "eyeRight", z: 51, anchorX: 54, anchorY: 27, physics: "face" },
  { id: "pupilLeft", z: 52, anchorX: 46, anchorY: 27, physics: "face" },
  { id: "pupilRight", z: 53, anchorX: 54, anchorY: 27, physics: "face" },
  { id: "mouth", z: 55, anchorX: 50, anchorY: 34, physics: "face" },
  { id: "hornLeft", z: 60, anchorX: 42, anchorY: 12, physics: "head" },
  { id: "hornRight", z: 61, anchorX: 58, anchorY: 12, physics: "head" },
  { id: "hairFront", z: 70, anchorX: 50, anchorY: 22, physics: "hair" },
  { id: "hairSideLeft", z: 71, anchorX: 39, anchorY: 32, physics: "hair" },
  { id: "hairSideRight", z: 72, anchorX: 61, anchorY: 32, physics: "hair" },
  { id: "accessories", z: 80, anchorX: 50, anchorY: 42, physics: "body" },
];

export const ONI_RIG_STATE_INTENSITY: Record<OniState, number> = {
  idle: 0.2,
  listening: 0.38,
  thinking: 0.3,
  speaking: 0.52,
  happy: 0.68,
  excited: 1,
  concerned: 0.34,
  serious: 0.24,
  surprised: 0.82,
  music: 0.78,
};
