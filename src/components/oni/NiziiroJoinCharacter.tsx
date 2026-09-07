import { useEffect, useMemo, useRef, useState } from "react";

import {
  checkJoinMembershipStatus,
  JOIN_MEMBERSHIP_WATCH_EVENT,
  JOIN_MEMBERSHIP_WATCH_KEY,
  readJoinMembershipWatch,
  saveJoinMembershipWatch,
  type JoinMembershipWatch,
} from "@/data/join";

type JoinGuideState = "idle" | "engaged" | "loading" | "success" | "error";
type MembershipPhase = "none" | "checking" | "pending" | "accepted" | "rejected";

type Props = {
  state: JoinGuideState;
  nickname?: string;
};

const MAO_MODEL_URL =
  "https://raw.githubusercontent.com/Live2D/CubismWebSamples/b1de66b0b1f1cb881d95fb6158622aeb6a2827bd/Samples/Resources/Mao/Mao.model3.json";

const LAST_APPLICATION_KEY = "oni_join_last_application_v1";
const OUTCOME_RELOAD_KEY = "oni_join_outcome_reload_v1";

function guideCopy(
  state: JoinGuideState,
  nickname?: string,
  membership?: MembershipPhase,
  reference?: string,
) {
  if (membership === "accepted") {
    return `${nickname?.trim() || "Rider"}, ONI & KISHIN-д тавтай морил! Таны хүсэлт зөвшөөрөгдөж Crew-д нэмэгдлээ.`;
  }
  if (membership === "rejected") {
    return `${nickname?.trim() || "Rider"}, таны хүсэлтийг энэ удаа зөвшөөрсөнгүй. Мэдээллээ шинэчлээд дахин хүсэлт илгээж болно.`;
  }
  if ((membership === "pending" || membership === "checking") && reference) {
    return `${nickname?.trim() || "Rider"}, таны хүсэлт хянагдаж байна. REF / ${reference}`;
  }
  if (state === "success") return "Амжилттай! Хүсэлтийг хүлээн авлаа.";
  if (state === "loading") return "Хүсэлтийг аюулгүй дамжуулж байна…";
  if (state === "error") return "Илгээхэд асуудал гарлаа. Мэдээллээ шалгаад дахин оролдоорой.";
  if (state === "engaged") return `${nickname?.trim() || "Rider"}, анкетаа үргэлжлүүлээрэй.`;
  return "ONI & KISHIN-д нэгдэхэд бэлэн үү?";
}

export function NiziiroJoinCharacter({ state, nickname }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [runtime, setRuntime] = useState<"loading" | "ready" | "failed">("loading");
  const [watch, setWatch] = useState<JoinMembershipWatch | null>(null);
  const [membership, setMembership] = useState<MembershipPhase>("none");
  const [approvedNickname, setApprovedNickname] = useState("");

  const effectiveState: JoinGuideState =
    membership === "accepted" ? "success" : membership === "rejected" ? "error" : state;
  const displayNickname = approvedNickname || nickname?.trim() || watch?.cpmNickname || "";

  const srcDoc = useMemo(
    () => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;touch-action:pan-y}
#stage{position:absolute;inset:0}
canvas{width:100%;height:100%;display:block;touch-action:none}
#loading{position:absolute;inset:auto 0 12px;text-align:center;font:600 9px/1.2 system-ui;letter-spacing:.22em;color:rgba(255,255,255,.46)}
</style>
</head>
<body>
<div id="stage"></div><div id="loading">LIVE2D INITIALIZING</div>
<script src="https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js"></script>
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js"></script>
<script>
(function(){
  var MODEL_URL=${JSON.stringify(MAO_MODEL_URL)};
  var model=null, app=null, resizeObserver=null, currentState="idle", tapCycle=0;
  var stage=document.getElementById("stage");
  var loading=document.getElementById("loading");

  function send(type){ parent.postMessage({source:"oni-niziiro-join",type:type},"*"); }
  function safeExpression(name){ try{ if(model&&model.expression) model.expression(name); }catch(e){} }
  function safeMotion(group,index){ try{ if(model&&model.motion) model.motion(group,index); }catch(e){} }

  function applyState(next){
    currentState=next||"idle";
    if(!model) return;
    if(currentState==="success"){ safeExpression("exp_04"); safeMotion("TapBody",4); return; }
    if(currentState==="loading"){ safeExpression("exp_03"); safeMotion("TapBody",0); return; }
    if(currentState==="error"){ safeExpression("exp_05"); safeMotion("TapBody",1); return; }
    if(currentState==="engaged"){ safeExpression("exp_07"); safeMotion("TapBody",2); return; }
    safeExpression("exp_01"); safeMotion("Idle",0);
  }

  function fit(){
    if(!app||!model) return;
    var w=Math.max(1,stage.clientWidth), h=Math.max(1,stage.clientHeight);
    app.renderer.resize(w,h);
    var baseW=Math.max(model.width/(model.scale.x||1),1);
    var baseH=Math.max(model.height/(model.scale.y||1),1);
    var scale=Math.min((w*.92)/baseW,(h*.94)/baseH);
    model.scale.set(scale);
    model.x=w*.5;
    model.y=h*.515;
  }

  window.addEventListener("message",function(event){
    var data=event.data;
    if(!data||data.source!=="oni-join-parent"||data.type!=="state") return;
    applyState(data.state);
  });

  function focusAt(clientX,clientY){
    if(!model||!model.focus) return;
    var rect=stage.getBoundingClientRect();
    var x=((clientX-rect.left)/Math.max(rect.width,1))*2-1;
    var y=-(((clientY-rect.top)/Math.max(rect.height,1))*2-1);
    try{ model.focus(Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y))); }catch(e){}
  }

  stage.addEventListener("pointermove",function(e){ focusAt(e.clientX,e.clientY); },{passive:true});
  stage.addEventListener("pointerdown",function(e){
    focusAt(e.clientX,e.clientY);
    if(!model) return;
    tapCycle=(tapCycle+1)%6;
    safeExpression(tapCycle%2===0?"exp_02":"exp_06");
    safeMotion("TapBody",tapCycle);
    window.setTimeout(function(){ applyState(currentState); },1700);
  },{passive:true});

  try{
    if(!window.PIXI||!PIXI.live2d||!PIXI.live2d.Live2DModel) throw new Error("Live2D runtime unavailable");
    app=new PIXI.Application({transparent:true,antialias:true,autoStart:true,resolution:Math.min(window.devicePixelRatio||1,2),autoDensity:true});
    stage.appendChild(app.view);
    PIXI.live2d.Live2DModel.from(MODEL_URL,{autoInteract:false}).then(function(loaded){
      model=loaded;
      model.anchor.set(.5,.5);
      app.stage.addChild(model);
      fit();
      resizeObserver=new ResizeObserver(fit);
      resizeObserver.observe(stage);
      applyState(currentState);
      if(loading) loading.remove();
      send("ready");
      window.setInterval(function(){
        if(!model) return;
        if(currentState==="idle") safeMotion("Idle",tapCycle%2);
        if(currentState==="success") safeMotion("TapBody",4);
      },7000);
    }).catch(function(error){ console.error("[ONI Join] Niziiro Mao load failed",error); if(loading) loading.textContent="LIVE2D OFFLINE"; send("failed"); });
  }catch(error){ console.error("[ONI Join] Live2D init failed",error); if(loading) loading.textContent="LIVE2D OFFLINE"; send("failed"); }
})();
</script>
</body>
</html>`,
    [],
  );

  useEffect(() => {
    const loadWatch = () => {
      const next = readJoinMembershipWatch();
      setWatch(next);
      if (!next) {
        setMembership("none");
        setApprovedNickname("");
        return;
      }
      if (next.accepted) {
        setMembership("accepted");
        setApprovedNickname(next.cpmNickname);
      } else if (next.rejected) {
        setMembership("rejected");
        setApprovedNickname("");
      } else {
        setMembership("pending");
      }
    };

    loadWatch();
    window.addEventListener(JOIN_MEMBERSHIP_WATCH_EVENT, loadWatch);
    return () => window.removeEventListener(JOIN_MEMBERSHIP_WATCH_EVENT, loadWatch);
  }, []);

  useEffect(() => {
    if (!watch || watch.accepted || watch.rejected) return;

    let cancelled = false;
    let timer = 0;

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 25_000);
    };

    const persistOutcomeAndReload = (
      outcome: "accepted" | "rejected",
      nextWatch: JoinMembershipWatch,
    ) => {
      saveJoinMembershipWatch(nextWatch);
      try {
        window.localStorage.removeItem(LAST_APPLICATION_KEY);
        if (!window.sessionStorage.getItem(OUTCOME_RELOAD_KEY)) {
          window.sessionStorage.setItem(OUTCOME_RELOAD_KEY, outcome);
          window.setTimeout(() => window.location.reload(), 1600);
        }
      } catch {
        // The final state is already visible even when browser storage is unavailable.
      }
    };

    const run = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }

      setMembership((current) =>
        current === "accepted" || current === "rejected" ? current : "checking",
      );
      const result = await checkJoinMembershipStatus(watch);
      if (cancelled) return;

      if (result.state === "accepted") {
        const acceptedWatch: JoinMembershipWatch = {
          ...watch,
          accepted: true,
          rejected: false,
          memberId: result.memberId,
        };
        setApprovedNickname(result.nickname || watch.cpmNickname);
        setMembership("accepted");
        persistOutcomeAndReload("accepted", acceptedWatch);
        return;
      }

      if (result.state === "rejected") {
        const rejectedWatch: JoinMembershipWatch = {
          ...watch,
          accepted: false,
          rejected: true,
        };
        setApprovedNickname("");
        setMembership("rejected");
        persistOutcomeAndReload("rejected", rejectedWatch);
        return;
      }

      setMembership("pending");
      schedule();
    };

    const onFocus = () => void run();
    void run();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [watch]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string } | undefined;
      if (!data || data.source !== "oni-niziiro-join") return;
      if (data.type === "ready") setRuntime("ready");
      if (data.type === "failed") setRuntime("failed");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      { source: "oni-join-parent", type: "state", state: effectiveState },
      "*",
    );
  }, [effectiveState, runtime]);

  const resetRejectedApplication = () => {
    try {
      window.localStorage.removeItem(JOIN_MEMBERSHIP_WATCH_KEY);
      window.localStorage.removeItem(LAST_APPLICATION_KEY);
      window.sessionStorage.removeItem(OUTCOME_RELOAD_KEY);
    } finally {
      window.location.reload();
    }
  };

  const statusBadge =
    membership === "accepted"
      ? "APPROVED"
      : membership === "rejected"
        ? "REJECTED"
        : membership === "checking"
          ? "CHECKING"
          : membership === "pending"
            ? "PENDING"
            : runtime === "ready"
              ? "ONLINE"
              : runtime === "failed"
                ? "OFFLINE"
                : "SYNC";

  const statusClass =
    membership === "accepted"
      ? "text-emerald-300/80"
      : membership === "rejected" || runtime === "failed"
        ? "text-crimson"
        : runtime === "ready"
          ? "text-emerald-300/80"
          : "text-white/40";

  const outcome = membership === "accepted" || membership === "rejected";

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border bg-black/20 shadow-2xl transition-colors duration-700 ${
        membership === "accepted"
          ? "border-emerald-300/35 shadow-emerald-400/10"
          : membership === "rejected"
            ? "border-crimson/40 shadow-crimson/15"
            : "border-white/10 shadow-crimson/10"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          membership === "accepted"
            ? "bg-[radial-gradient(circle_at_50%_58%,rgba(110,255,190,0.19),transparent_54%)]"
            : membership === "rejected"
              ? "bg-[radial-gradient(circle_at_50%_58%,rgba(255,55,85,0.18),transparent_54%)]"
              : "bg-[radial-gradient(circle_at_50%_58%,rgba(255,68,110,0.18),transparent_52%)]"
        }`}
      />

      {membership === "accepted" ? (
        <div className="pointer-events-none absolute inset-0 z-[2] opacity-70">
          <span className="absolute left-[12%] top-[18%] h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200" />
          <span className="absolute right-[16%] top-[28%] h-1 w-1 animate-pulse rounded-full bg-white" />
          <span className="absolute left-[20%] top-[48%] h-1 w-1 animate-pulse rounded-full bg-white" />
          <span className="absolute right-[18%] top-[58%] h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200" />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-5 top-4 z-10 flex items-center justify-between text-[0.58rem] font-semibold tracking-[0.2em] text-white/55">
        <span>NIZIIRO MAO / LIVE2D</span>
        <span className={statusClass}>{statusBadge}</span>
      </div>

      <iframe
        ref={frameRef}
        title="Niziiro Mao Live2D join guide"
        srcDoc={srcDoc}
        className="relative z-[1] block h-[360px] w-full border-0 sm:h-[430px] lg:h-[500px]"
        onLoad={() =>
          frameRef.current?.contentWindow?.postMessage(
            { source: "oni-join-parent", type: "state", state: effectiveState },
            "*",
          )
        }
      />

      <div
        className={`absolute inset-x-4 bottom-4 z-10 rounded-2xl border px-4 py-3 backdrop-blur-xl ${
          membership === "accepted"
            ? "border-emerald-300/25 bg-black/65"
            : membership === "rejected"
              ? "border-crimson/30 bg-black/70"
              : "pointer-events-none border-white/10 bg-black/55"
        }`}
      >
        <p className="text-xs leading-relaxed text-white/88">
          {guideCopy(effectiveState, displayNickname, membership, watch?.reference)}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p
            className={`text-[0.6rem] tracking-[0.14em] ${
              membership === "accepted"
                ? "text-emerald-200/80"
                : membership === "rejected"
                  ? "text-crimson/85"
                  : "text-white/40"
            }`}
          >
            {membership === "accepted"
              ? "APPROVED · CREW ACTIVE"
              : membership === "rejected"
                ? "REJECTED · RETRY AVAILABLE"
                : membership === "pending" || membership === "checking"
                  ? "AUTO STATUS · 25 SEC"
                  : "ДҮР ДЭЭР ДАРЖ REACTION ҮЗЭЭРЭЙ"}
          </p>
          {membership === "accepted" ? (
            <a
              href="/crew"
              className="shrink-0 border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-[0.58rem] font-semibold tracking-[0.14em] text-emerald-100 transition-colors hover:bg-emerald-300/20"
            >
              CREW-Д ОРОХ
            </a>
          ) : membership === "rejected" ? (
            <button
              type="button"
              onClick={resetRejectedApplication}
              className="shrink-0 border border-crimson/40 bg-crimson/10 px-3 py-2 text-[0.58rem] font-semibold tracking-[0.14em] text-white transition-colors hover:bg-crimson/20"
            >
              ШИНЭ ХҮСЭЛТ
            </button>
          ) : null}
        </div>
      </div>

      {outcome ? <span className="sr-only" aria-live="polite">{statusBadge}</span> : null}
    </div>
  );
}
