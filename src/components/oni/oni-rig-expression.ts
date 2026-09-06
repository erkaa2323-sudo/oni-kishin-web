import type { OniState } from "@/lib/oni-emotion";

export type OniRigExpression = {
  eyeOpen: number;
  eyeSmile: number;
  pupilScale: number;
  mouthOpen: number;
  mouthSmile: number;
  blush: number;
  headTilt: number;
  bodyEnergy: number;
};

export const ONI_RIG_EXPRESSIONS: Record<OniState, OniRigExpression> = {
  idle: { eyeOpen: 1, eyeSmile: 0, pupilScale: 1, mouthOpen: 0.08, mouthSmile: 0.18, blush: 0.08, headTilt: -0.2, bodyEnergy: 0.2 },
  listening: { eyeOpen: 1.04, eyeSmile: 0.04, pupilScale: 1.04, mouthOpen: 0.04, mouthSmile: 0.12, blush: 0.06, headTilt: -1.2, bodyEnergy: 0.38 },
  thinking: { eyeOpen: 0.84, eyeSmile: 0, pupilScale: 0.96, mouthOpen: 0.03, mouthSmile: -0.04, blush: 0.03, headTilt: 1.4, bodyEnergy: 0.3 },
  speaking: { eyeOpen: 1, eyeSmile: 0.08, pupilScale: 1, mouthOpen: 0.72, mouthSmile: 0.18, blush: 0.08, headTilt: -0.35, bodyEnergy: 0.52 },
  happy: { eyeOpen: 0.78, eyeSmile: 0.8, pupilScale: 1.05, mouthOpen: 0.45, mouthSmile: 1, blush: 0.28, headTilt: -1.1, bodyEnergy: 0.68 },
  excited: { eyeOpen: 1.12, eyeSmile: 0.38, pupilScale: 1.1, mouthOpen: 0.7, mouthSmile: 0.92, blush: 0.24, headTilt: -1.8, bodyEnergy: 1 },
  concerned: { eyeOpen: 0.9, eyeSmile: -0.12, pupilScale: 0.98, mouthOpen: 0.06, mouthSmile: -0.34, blush: 0.03, headTilt: 0.8, bodyEnergy: 0.34 },
  serious: { eyeOpen: 0.82, eyeSmile: -0.22, pupilScale: 0.94, mouthOpen: 0.02, mouthSmile: -0.5, blush: 0, headTilt: 0, bodyEnergy: 0.24 },
  surprised: { eyeOpen: 1.28, eyeSmile: 0, pupilScale: 0.88, mouthOpen: 0.82, mouthSmile: 0.02, blush: 0.1, headTilt: 0.4, bodyEnergy: 0.82 },
  music: { eyeOpen: 0.82, eyeSmile: 0.58, pupilScale: 1.02, mouthOpen: 0.28, mouthSmile: 0.72, blush: 0.18, headTilt: -1.4, bodyEnergy: 0.78 },
};
