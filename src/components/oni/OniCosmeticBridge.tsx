import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";

type Equipped = Record<string, string>;

const EMPTY: Equipped = {};

export function OniCosmeticBridge() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [equipped, setEquipped] = useState<Equipped>(EMPTY);

  useEffect(() => {
    let stopProfile: (() => void) | null = null;
    const stopAuth = onAuthStateChanged(firebaseAuth, (user) => {
      stopProfile?.();
      stopProfile = null;
      if (!user) {
        setEquipped(EMPTY);
        return;
      }
      stopProfile = onSnapshot(
        doc(firebaseDb, "progressionProfiles", user.uid),
        (snap) => {
          const value = snap.exists() ? snap.data()["equipped"] : null;
          setEquipped(value && typeof value === "object" ? (value as Equipped) : EMPTY);
        },
        () => setEquipped(EMPTY),
      );
    });
    return () => {
      stopProfile?.();
      stopAuth();
    };
  }, []);

  const active = useMemo(() => new Set(Object.values(equipped)), [equipped]);
  const progressionSurface = pathname.startsWith("/progression") || pathname.startsWith("/shop");
  const frame = active.has("frame-crimson");
  const aura = active.has("aura-red-moon");
  const garage = active.has("garage-neon") && pathname.startsWith("/garage");
  const shizuki = active.has("shizuki-kitsune") && pathname.startsWith("/oni-ai");
  const title =
    active.has("title-night-rider") &&
    (pathname.startsWith("/profile") || pathname.startsWith("/crew") || progressionSurface);
  const entrance = active.has("entrance-kishin") && pathname.startsWith("/meet");
  const creator = active.has("creator-red-moon") && pathname.startsWith("/gallery");
  const trophy = active.has("trophy-vault") && (pathname.startsWith("/profile") || progressionSurface);

  useEffect(() => {
    const root = document.documentElement;
    const pairs: Array<[string, boolean]> = [
      ["oniFrameCrimson", frame],
      ["oniAuraRedMoon", aura],
      ["oniGarageNeon", garage],
      ["oniShizukiKitsune", shizuki],
      ["oniTitleNightRider", title],
      ["oniEntranceKishin", entrance],
      ["oniCreatorRedMoon", creator],
      ["oniTrophyVault", trophy],
    ];
    for (const [key, value] of pairs) {
      if (value) root.dataset[key] = "1";
      else delete root.dataset[key];
    }
    return () => {
      for (const [key] of pairs) delete root.dataset[key];
    };
  }, [frame, aura, garage, shizuki, title, entrance, creator, trophy]);

  if (![frame, aura, garage, shizuki, title, entrance, creator, trophy].some(Boolean)) return null;

  return (
    <>
      <style>{`
      .oni-cosmetic-layer{position:fixed;inset:0;pointer-events:none;z-index:3;overflow:hidden}
      .oni-crimson-frame{position:fixed;inset:max(env(safe-area-inset-top),5px) 5px max(env(safe-area-inset-bottom),5px);z-index:72;pointer-events:none;border:2px solid rgba(251,113,133,.86);box-shadow:inset 0 0 52px rgba(225,29,72,.2),inset 0 0 9px rgba(255,255,255,.08),0 0 28px rgba(225,29,72,.34),0 0 90px rgba(127,29,29,.18);animation:oniFramePulse 2.8s ease-in-out infinite}
      .oni-crimson-frame:before,.oni-crimson-frame:after{content:"";position:absolute;inset:10px;border:1px solid rgba(244,63,94,.24);clip-path:polygon(0 0,17% 0,17% 1px,83% 1px,83% 0,100% 0,100% 20%,calc(100% - 1px) 20%,calc(100% - 1px) 80%,100% 80%,100% 100%,83% 100%,83% calc(100% - 1px),17% calc(100% - 1px),17% 100%,0 100%,0 80%,1px 80%,1px 20%,0 20%)}
      .oni-crimson-frame:after{inset:0;background:linear-gradient(90deg,transparent 8%,rgba(251,113,133,.75) 22%,transparent 36%,transparent 64%,rgba(251,113,133,.75) 78%,transparent 92%) top/100% 2px no-repeat,linear-gradient(90deg,transparent 8%,rgba(251,113,133,.55) 22%,transparent 36%,transparent 64%,rgba(251,113,133,.55) 78%,transparent 92%) bottom/100% 2px no-repeat;animation:oniFrameScan 3.6s linear infinite}
      .oni-crimson-node{position:absolute;width:34px;height:34px;border-color:rgba(255,170,180,.95);filter:drop-shadow(0 0 10px rgba(244,63,94,.75))}
      .oni-crimson-node.n1{left:-3px;top:-3px;border-left:4px solid;border-top:4px solid}.oni-crimson-node.n2{right:-3px;top:-3px;border-right:4px solid;border-top:4px solid}.oni-crimson-node.n3{left:-3px;bottom:-3px;border-left:4px solid;border-bottom:4px solid}.oni-crimson-node.n4{right:-3px;bottom:-3px;border-right:4px solid;border-bottom:4px solid}
      .oni-red-moon-aura{position:fixed;z-index:2;pointer-events:none;width:min(104vw,760px);height:min(104vw,760px);left:50%;top:48%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,80,105,.2) 0 12%,rgba(190,18,60,.18) 28%,rgba(127,29,29,.1) 48%,transparent 72%);filter:blur(.2px);animation:oniAuraBreathe 4.4s ease-in-out infinite}
      .oni-red-moon-aura:before{content:"";position:absolute;left:50%;top:50%;width:42%;height:42%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 36% 32%,rgba(255,210,215,.62),rgba(244,63,94,.38) 23%,rgba(159,18,57,.32) 50%,rgba(45,3,12,.16) 68%,transparent 72%);box-shadow:0 0 46px rgba(244,63,94,.38),0 0 130px rgba(127,29,29,.35)}
      .oni-red-moon-aura:after{content:"";position:absolute;inset:12%;border:1px solid rgba(251,113,133,.22);border-radius:50%;box-shadow:0 0 34px rgba(225,29,72,.15);animation:oniMoonRing 8s linear infinite}
      .oni-neon-garage{position:absolute;inset:24% -28% -34%;opacity:.52;transform:perspective(460px) rotateX(61deg);transform-origin:center top;background-image:linear-gradient(rgba(244,63,94,.42) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.34) 1px,transparent 1px);background-size:32px 32px;mask-image:linear-gradient(to bottom,transparent,#000 13%,#000 82%,transparent);filter:drop-shadow(0 0 13px rgba(244,63,94,.28));animation:oniGarageDrift 6s linear infinite}
      .oni-neon-garage:before,.oni-neon-garage:after{content:"";position:absolute;left:20%;right:20%;height:2px;background:linear-gradient(90deg,transparent,#fb7185,#38bdf8,transparent);box-shadow:0 0 22px rgba(244,63,94,.6)}.oni-neon-garage:before{top:15%}.oni-neon-garage:after{top:36%}
      .oni-creator-moon{position:absolute;width:min(52vw,360px);height:min(52vw,360px);border-radius:50%;right:-72px;top:8%;background:radial-gradient(circle at 36% 30%,rgba(255,220,224,.82),rgba(251,113,133,.52) 18%,rgba(190,18,60,.45) 42%,rgba(60,2,14,.16) 68%,transparent 73%);box-shadow:0 0 90px rgba(225,29,72,.42),0 0 180px rgba(127,29,29,.22);animation:oniCreatorOrbit 7s ease-in-out infinite}
      .oni-foxfire{position:absolute;width:22px;height:42px;border-radius:60% 40% 60% 40%;background:radial-gradient(circle at 50% 70%,#fff 0 9%,#fde68a 24%,rgba(251,113,133,.95) 47%,rgba(124,58,237,.38) 68%,transparent 74%);filter:blur(.25px) drop-shadow(0 0 14px rgba(244,63,94,.75));animation:oniFoxFloat 3.8s ease-in-out infinite}
      .oni-foxfire:nth-child(1){left:10%;top:28%}.oni-foxfire:nth-child(2){right:12%;top:42%;animation-delay:-1.2s}.oni-foxfire:nth-child(3){left:29%;bottom:16%;animation-delay:-2.3s}
      .oni-cosmetic-badge{position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 74px);z-index:73;border:1px solid rgba(251,113,133,.72);background:linear-gradient(135deg,rgba(22,3,8,.94),rgba(5,5,7,.9));backdrop-filter:blur(18px);padding:10px 14px;color:#fff;font:800 10px/1 system-ui;letter-spacing:.22em;pointer-events:none;box-shadow:0 0 28px rgba(225,29,72,.22),inset 0 0 24px rgba(225,29,72,.08)}
      .oni-night-rider-title{right:50%;transform:translateX(50%);top:calc(env(safe-area-inset-top) + 78px);padding:12px 22px;border-color:rgba(244,63,94,.92);font-size:11px;text-shadow:0 0 12px rgba(251,113,133,.9);box-shadow:0 0 35px rgba(225,29,72,.32),inset 0 0 28px rgba(225,29,72,.12);animation:oniTitlePulse 2.6s ease-in-out infinite}
      .oni-kishin-arrival{position:fixed;inset:0;z-index:74;display:grid;place-items:center;pointer-events:none;background:radial-gradient(circle,rgba(127,29,29,.2),rgba(0,0,0,.28) 50%,transparent 72%);animation:oniArrivalOut 3.2s forwards}
      .oni-kishin-arrival span{position:relative;border-top:2px solid rgba(251,113,133,.88);border-bottom:2px solid rgba(244,63,94,.5);padding:18px 34px;background:linear-gradient(90deg,rgba(3,3,5,.4),rgba(40,2,10,.88),rgba(3,3,5,.4));box-shadow:0 0 85px rgba(225,29,72,.5);font:900 clamp(22px,8vw,54px)/1 system-ui;letter-spacing:.28em;color:#fff;text-shadow:0 0 22px rgba(251,113,133,.8);animation:oniArrivalIn .62s cubic-bezier(.15,.85,.2,1)}
      @keyframes oniFramePulse{50%{box-shadow:inset 0 0 68px rgba(225,29,72,.27),inset 0 0 12px rgba(255,255,255,.1),0 0 38px rgba(225,29,72,.48),0 0 120px rgba(127,29,29,.24)}}
      @keyframes oniFrameScan{50%{filter:brightness(1.45)}}
      @keyframes oniAuraBreathe{50%{transform:translate(-50%,-50%) scale(1.09);opacity:.84}}
      @keyframes oniMoonRing{to{transform:rotate(360deg)}}
      @keyframes oniGarageDrift{to{background-position:0 64px,64px 0}}
      @keyframes oniCreatorOrbit{50%{transform:translate(-12px,10px) scale(1.06)}}
      @keyframes oniFoxFloat{50%{transform:translateY(-34px) scale(1.38) rotate(8deg);opacity:.68}}
      @keyframes oniTitlePulse{50%{filter:brightness(1.28);box-shadow:0 0 48px rgba(225,29,72,.44),inset 0 0 34px rgba(225,29,72,.16)}}
      @keyframes oniArrivalIn{from{transform:scale(.58);opacity:0;letter-spacing:.6em;filter:blur(8px)}to{transform:scale(1);opacity:1;filter:blur(0)}}
      @keyframes oniArrivalOut{0%,66%{opacity:1}100%{opacity:0;visibility:hidden}}
      @media(prefers-reduced-motion:reduce){.oni-crimson-frame,.oni-crimson-frame:after,.oni-red-moon-aura,.oni-red-moon-aura:after,.oni-neon-garage,.oni-creator-moon,.oni-foxfire,.oni-night-rider-title,.oni-kishin-arrival,.oni-kishin-arrival span{animation:none}.oni-kishin-arrival{display:none}}
    `}</style>
      {aura ? <div className="oni-red-moon-aura" aria-hidden="true" /> : null}
      {frame ? (
        <div className="oni-crimson-frame" aria-hidden="true">
          <i className="oni-crimson-node n1" />
          <i className="oni-crimson-node n2" />
          <i className="oni-crimson-node n3" />
          <i className="oni-crimson-node n4" />
        </div>
      ) : null}
      {garage || shizuki || creator ? (
        <div className="oni-cosmetic-layer" aria-hidden="true">
          {garage ? <div className="oni-neon-garage" /> : null}
          {creator ? <div className="oni-creator-moon" /> : null}
          {shizuki ? (
            <>
              <i className="oni-foxfire" />
              <i className="oni-foxfire" />
              <i className="oni-foxfire" />
            </>
          ) : null}
        </div>
      ) : null}
      {title ? <div className="oni-cosmetic-badge oni-night-rider-title">NIGHT RIDER</div> : null}
      {trophy ? (
        <div className="oni-cosmetic-badge" style={{ top: "calc(env(safe-area-inset-top) + 122px)" }}>
          TROPHY VAULT +1
        </div>
      ) : null}
      {entrance ? (
        <div className="oni-kishin-arrival" aria-hidden="true">
          <span>KISHIN ARRIVAL</span>
        </div>
      ) : null}
    </>
  );
}
