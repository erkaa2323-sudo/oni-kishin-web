import type { OniState } from "@/lib/oni-emotion";

type Motion = { headX:number; headY:number; headZ:number; bodyX:number; breath:number; hair:number; arm:number; blinkRate:number; talk:number };

export const ONI_WEB_LIVE2D_MOTIONS: Record<OniState, Motion> = {
 idle:{headX:1.2,headY:.6,headZ:.5,bodyX:.5,breath:1,hair:.55,arm:.2,blinkRate:5.2,talk:0},
 listening:{headX:2.4,headY:1.1,headZ:1.4,bodyX:.8,breath:.8,hair:.65,arm:.3,blinkRate:4.6,talk:0},
 thinking:{headX:1.6,headY:.8,headZ:2.1,bodyX:.6,breath:.65,hair:.45,arm:.2,blinkRate:6,talk:0},
 speaking:{headX:2.2,headY:1,headZ:1.1,bodyX:1,breath:.9,hair:.8,arm:.65,blinkRate:4.8,talk:1},
 happy:{headX:3,headY:1.5,headZ:2.2,bodyX:1.5,breath:1.1,hair:1,arm:1,blinkRate:3.8,talk:.25},
 excited:{headX:4,headY:2,headZ:2.8,bodyX:2,breath:1.25,hair:1.35,arm:1.4,blinkRate:3.4,talk:.35},
 concerned:{headX:1.2,headY:.7,headZ:1.2,bodyX:.45,breath:.6,hair:.35,arm:.15,blinkRate:5.8,talk:.05},
 serious:{headX:.7,headY:.4,headZ:.4,bodyX:.25,breath:.45,hair:.25,arm:.08,blinkRate:6.5,talk:.05},
 surprised:{headX:3.2,headY:2.4,headZ:1.3,bodyX:1.6,breath:1.15,hair:1.1,arm:.8,blinkRate:4.2,talk:.3},
 music:{headX:3.5,headY:1.4,headZ:2.4,bodyX:2.2,breath:1,hair:1.4,arm:1.2,blinkRate:4.1,talk:.2},
};
