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
    active.has("title-night-rider") && (pathname.startsWith("/crew") || progressionSurface);
  const entrance = active.has("entrance-kishin") && pathname.startsWith("/meet");
  const creator = active.has("creator-red-moon") && pathname.startsWith("/gallery");
  const trophy = active.has("trophy-vault") && progressionSurface;

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
      .oni-crimson-frame{position:fixed;inset:max(env(safe-area-inset-top),4px) 4px max(env(safe-area-inset-bottom),4px);z-index:72;pointer-events:none;border:1px solid rgba(244,63,94,.5);box-shadow:inset 0 0 34px rgba(225,29,72,.12),0 0 22px rgba(225,29,72,.08)}
      .oni-crimson-frame:before,.oni-crimson-frame:after{content:"";position:absolute;width:72px;height:2px;background:linear-gradient(90deg,transparent,#fb7185)}
      .oni-crimson-frame:before{left:8px;top:8px}.oni-crimson-frame:after{right:8px;bottom:8px;transform:rotate(180deg)}
      .oni-red-moon-aura{position:fixed;z-index:2;pointer-events:none;width:min(76vw,560px);height:min(76vw,560px);left:50%;top:48%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(225,29,72,.14),rgba(127,29,29,.055) 42%,transparent 72%);filter:blur(1px);animation:oniAuraBreathe 5s ease-in-out infinite}
      .oni-neon-garage{position:absolute;inset:34% -25% -32%;opacity:.26;transform:perspective(420px) rotateX(62deg);transform-origin:center top;background-image:linear-gradient(rgba(244,63,94,.28) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.2) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,transparent,#000 18%,#000 75%,transparent)}
      .oni-creator-moon{position:absolute;width:210px;height:210px;border-radius:50%;right:-45px;top:12%;background:radial-gradient(circle at 36% 30%,rgba(255,160,170,.65),rgba(190,18,60,.32) 42%,rgba(60,2,14,.08) 67%,transparent 72%);filter:blur(.2px);box-shadow:0 0 90px rgba(225,29,72,.2)}
      .oni-foxfire{position:absolute;width:12px;height:24px;border-radius:60% 40% 60% 40%;background:radial-gradient(circle at 50% 70%,#fff 0 8%,#fbbf24 28%,rgba(244,63,94,.75) 52%,transparent 70%);filter:blur(.4px);animation:oniFoxFloat 4s ease-in-out infinite}
      .oni-foxfire:nth-child(1){left:13%;top:32%}.oni-foxfire:nth-child(2){right:16%;top:48%;animation-delay:-1.4s}.oni-foxfire:nth-child(3){left:28%;bottom:18%;animation-delay:-2.6s}
      .oni-cosmetic-badge{position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 72px);z-index:73;border:1px solid rgba(244,63,94,.34);background:rgba(5,5,7,.84);backdrop-filter:blur(14px);padding:7px 10px;color:#fff;font:700 9px/1 system-ui;letter-spacing:.18em;pointer-events:none}
      .oni-kishin-arrival{position:fixed;inset:0;z-index:74;display:grid;place-items:center;pointer-events:none;animation:oniArrivalOut 2.8s forwards}
      .oni-kishin-arrival span{border-top:1px solid rgba(244,63,94,.6);border-bottom:1px solid rgba(244,63,94,.3);padding:13px 28px;background:rgba(3,3,5,.76);box-shadow:0 0 65px rgba(225,29,72,.28);font:800 clamp(18px,7vw,42px)/1 system-ui;letter-spacing:.24em;color:#fff;animation:oniArrivalIn .55s cubic-bezier(.2,.8,.2,1)}
      @keyframes oniAuraBreathe{50%{transform:translate(-50%,-50%) scale(1.08);opacity:.74}}
      @keyframes oniFoxFloat{50%{transform:translateY(-22px) scale(1.25);opacity:.58}}
      @keyframes oniArrivalIn{from{transform:scale(.72);opacity:0;letter-spacing:.5em}to{transform:scale(1);opacity:1}}
      @keyframes oniArrivalOut{0%,62%{opacity:1}100%{opacity:0;visibility:hidden}}
      @media(prefers-reduced-motion:reduce){.oni-red-moon-aura,.oni-foxfire,.oni-kishin-arrival,.oni-kishin-arrival span{animation:none}.oni-kishin-arrival{display:none}}
    `}</style>
      {aura ? <div className="oni-red-moon-aura" aria-hidden="true" /> : null}
      {frame ? <div className="oni-crimson-frame" aria-hidden="true" /> : null}
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
      {title ? <div className="oni-cosmetic-badge">NIGHT RIDER</div> : null}
      {trophy ? (
        <div
          className="oni-cosmetic-badge"
          style={{ top: "calc(env(safe-area-inset-top) + 104px)" }}
        >
          TROPHY SLOT +1
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
