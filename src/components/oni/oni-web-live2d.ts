import type { OniState } from "@/lib/oni-emotion";

type Motion = {
  headX: number;
  headY: number;
  headZ: number;
  bodyX: number;
  breath: number;
  hair: number;
  arm: number;
  blinkRate: number;
  talk: number;
};

export const ONI_WEB_LIVE2D_MOTIONS: Record<OniState, Motion> = {
  idle: {
    headX: 1.2,
    headY: 0.6,
    headZ: 0.5,
    bodyX: 0.5,
    breath: 1,
    hair: 0.55,
    arm: 0.2,
    blinkRate: 5.2,
    talk: 0,
  },
  listening: {
    headX: 2.4,
    headY: 1.1,
    headZ: 1.4,
    bodyX: 0.8,
    breath: 0.8,
    hair: 0.65,
    arm: 0.3,
    blinkRate: 4.6,
    talk: 0,
  },
  thinking: {
    headX: 1.6,
    headY: 0.8,
    headZ: 2.1,
    bodyX: 0.6,
    breath: 0.65,
    hair: 0.45,
    arm: 0.2,
    blinkRate: 6,
    talk: 0,
  },
  speaking: {
    headX: 2.2,
    headY: 1,
    headZ: 1.1,
    bodyX: 1,
    breath: 0.9,
    hair: 0.8,
    arm: 0.65,
    blinkRate: 4.8,
    talk: 1,
  },
  happy: {
    headX: 3,
    headY: 1.5,
    headZ: 2.2,
    bodyX: 1.5,
    breath: 1.1,
    hair: 1,
    arm: 1,
    blinkRate: 3.8,
    talk: 0.25,
  },
  excited: {
    headX: 4,
    headY: 2,
    headZ: 2.8,
    bodyX: 2,
    breath: 1.25,
    hair: 1.35,
    arm: 1.4,
    blinkRate: 3.4,
    talk: 0.35,
  },
  concerned: {
    headX: 1.2,
    headY: 0.7,
    headZ: 1.2,
    bodyX: 0.45,
    breath: 0.6,
    hair: 0.35,
    arm: 0.15,
    blinkRate: 5.8,
    talk: 0.05,
  },
  serious: {
    headX: 0.7,
    headY: 0.4,
    headZ: 0.4,
    bodyX: 0.25,
    breath: 0.45,
    hair: 0.25,
    arm: 0.08,
    blinkRate: 6.5,
    talk: 0.05,
  },
  surprised: {
    headX: 3.2,
    headY: 2.4,
    headZ: 1.3,
    bodyX: 1.6,
    breath: 1.15,
    hair: 1.1,
    arm: 0.8,
    blinkRate: 4.2,
    talk: 0.3,
  },
  music: {
    headX: 3.5,
    headY: 1.4,
    headZ: 2.4,
    bodyX: 2.2,
    breath: 1,
    hair: 1.4,
    arm: 1.2,
    blinkRate: 4.1,
    talk: 0.2,
  },
};
