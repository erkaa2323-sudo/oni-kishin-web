import { useEffect, useMemo, useRef, useState } from "react";

import type { MeetLifecycle } from "@/data/meet";

type RegistrationState = "idle" | "sending" | "denied" | "registered";
type HostState = "idle" | "open" | "live" | "loading" | "registered" | "full" | "closed";

type Props = {
  life: MeetLifecycle;
  registrationState: RegistrationState;
  nickname?: string;
  participants: number;
  capacity: number | null;
};

const REN_MODEL_URL =
  "https://raw.githubusercontent.com/Live2D/CubismWebSamples/b1de66b0b1f1cb881d95fb6158622aeb6a2827bd/Samples/Resources/Ren/Ren.model3.json";

function resolveHostState(life: MeetLifecycle, registrationState: RegistrationState): HostState {
  if (registrationState === "registered") return "registered";
  if (registrationState === "sending") return "loading";
  if (life === "active") return "live";
  if (life === "open" || life === "starting_soon") return "open";
  if (life === "full") return "full";
  if (life === "closed" || life === "ended") return "closed";
  return "idle";
}

function hostCopy(state: HostState, nickname?: string) {
  const rider = nickname?.trim() || "Rider";
  if (state === "registered") return `${rider}, Meet access бэлэн боллоо.`;
  if (state === "loading") return "Бүртгэлийг шалгаж байна…";
  if (state === "live") return "ONI MEET эхэлсэн. Room access-аа шалгаарай.";
  if (state === "open") return "Бүртгэл нээлттэй. Crew аккаунтаа баталгаажуулаад нэгдээрэй.";
  if (state === "full") return "Meet дүүрсэн байна. Дараагийн мэдээллийг эндээс хүлээнэ үү.";
  if (state === "closed") return "Энэ Meet-ийн бүртгэл хаагдсан байна.";
  return "ONI MEET host online. Дараагийн уулзалтыг хүлээж байна.";
}

export function RenMeetHost({ life, registrationState, nickname, participants, capacity }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [runtime, setRuntime] = useState<"loading" | "ready" | "failed">("loading");
  const hostState = resolveHostState(life, registrationState);

  const srcDoc = useMemo(
    () => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;touch-action:pan-y}
#stage{position:absolute;inset:0}
canvas{display:block;width:100%;height:100%;touch-action:none}
#loading{position:absolute;left:0;right:0;bottom:12px;text-align:center;font:600 9px/1.2 system-ui;letter-spacing:.2em;color:rgba(255,255,255,.42)}
</style>
<script type="importmap">{"imports":{"pixi.js":"https://esm.sh/pixi.js@8.13.2"}}</script>
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
</head>
<body>
<div id="stage"></div><div id="loading">REN / CUBISM 5.3 INITIALIZING</div>
<script type="module">
import { Application, Ticker } from "pixi.js";
import { Live2DModel } from "https://esm.sh/@laplace.live/pixijs-live2d@0.2.0?external=pixi.js";

const MODEL_URL=${JSON.stringify(REN_MODEL_URL)};
const stage=document.getElementById("stage");
const loading=document.getElementById("loading");
let app=null, model=null, currentState="idle", tapCycle=0, observer=null;
const send=(type)=>parent.postMessage({source:"oni-ren-meet",type},"*");
const expr=(name)=>{try{model?.expression?.(name)}catch{}};
const motion=(group,index)=>{try{model?.motion?.(group,index)}catch{}};

function applyState(next){
  currentState=next||"idle";
  if(!model) return;
  if(currentState==="registered"){expr("exp_05");motion("TapBody",1);return;}
  if(currentState==="loading"){expr("exp_03");return;}
  if(currentState==="live"){expr("exp_02");motion("TapBody",0);return;}
  if(currentState==="open"){expr("exp_02");return;}
  if(currentState==="full"||currentState==="closed"){expr("exp_04");return;}
  expr("exp_01");motion("Idle",0);
}

function fit(){
  if(!app||!model) return;
  const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
  app.renderer.resize(w,h);
  const sx=model.scale.x||1,sy=model.scale.y||1;
  const baseW=Math.max(model.width/sx,1),baseH=Math.max(model.height/sy,1);
  const scale=Math.min((w*.92)/baseW,(h*.94)/baseH);
  model.scale.set(scale);
  model.x=w*.5;
  model.y=h*.51;
}

function focusAt(clientX,clientY){
  if(!model?.focus) return;
  const rect=stage.getBoundingClientRect();
  const x=((clientX-rect.left)/Math.max(rect.width,1))*2-1;
  const y=-(((clientY-rect.top)/Math.max(rect.height,1))*2-1);
  try{model.focus(Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y)))}catch{}
}

window.addEventListener("message",(event)=>{
  const data=event.data;
  if(!data||data.source!=="oni-meet-parent"||data.type!=="state") return;
  applyState(data.state);
});
stage.addEventListener("pointermove",(e)=>focusAt(e.clientX,e.clientY),{passive:true});
stage.addEventListener("pointerdown",(e)=>{
  focusAt(e.clientX,e.clientY);
  tapCycle=(tapCycle+1)%2;
  expr(tapCycle?"exp_03":"exp_02");
  motion("TapBody",tapCycle);
  window.setTimeout(()=>applyState(currentState),1500);
},{passive:true});

document.addEventListener("visibilitychange",()=>{
  if(!app) return;
  if(document.hidden) app.stop(); else app.start();
});

try{
  if(!window.Live2DCubismCore) throw new Error("Cubism 5.3 Core unavailable");
  app=new Application();
  await app.init({backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio||1,innerWidth<640?1.25:1.75),autoDensity:true});
  app.ticker.maxFPS=innerWidth<640?30:45;
  stage.appendChild(app.canvas);
  Live2DModel.registerTicker(Ticker);
  model=await Live2DModel.from(MODEL_URL,{autoInteract:false});
  model.anchor.set(.5,.5);
  app.stage.addChild(model);
  fit();
  observer=new ResizeObserver(fit);observer.observe(stage);
  applyState(currentState);
  loading?.remove();
  send("ready");
  window.setInterval(()=>{if(model&&currentState==="idle")motion("Idle",0)},8500);
}catch(error){
  console.error("[ONI Meet] Ren Foster init failed",error);
  if(loading) loading.textContent="REN LIVE2D OFFLINE";
  send("failed");
}
</script>
</body>
</html>`,
    [],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string } | undefined;
      if (!data || data.source !== "oni-ren-meet") return;
      if (data.type === "ready") setRuntime("ready");
      if (data.type === "failed") setRuntime("failed");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      { source: "oni-meet-parent", type: "state", state: hostState },
      "*",
    );
  }, [hostState, runtime]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden border border-white/10 bg-black/30 shadow-2xl shadow-crimson/10 clip-notch">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(255,65,85,0.16),transparent_56%)]" />
      <div className="pointer-events-none absolute inset-x-4 top-3 z-10 flex items-center justify-between gap-3 text-[0.56rem] font-semibold tracking-[0.18em] text-white/55">
        <span>REN FOSTER / MEET HOST</span>
        <span className={runtime === "ready" ? "text-emerald-300/80" : runtime === "failed" ? "text-crimson" : "text-white/40"}>
          {runtime === "ready" ? "ONLINE" : runtime === "failed" ? "OFFLINE" : "SYNC"}
        </span>
      </div>

      <iframe
        ref={frameRef}
        title="Ren Foster Live2D Meet host"
        srcDoc={srcDoc}
        className="absolute inset-0 h-full w-full border-0"
        onLoad={() =>
          frameRef.current?.contentWindow?.postMessage(
            { source: "oni-meet-parent", type: "state", state: hostState },
            "*",
          )
        }
      />

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 border border-white/10 bg-black/60 px-3 py-2.5 backdrop-blur-xl clip-notch">
        <p className="text-[0.7rem] leading-relaxed text-white/90">{hostCopy(hostState, nickname)}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.54rem] tracking-[0.14em] text-white/40">
          <span>ALWAYS-ON HOST</span>
          <span>{participants}{capacity !== null ? ` / ${capacity}` : ""} RIDERS</span>
        </div>
      </div>
    </div>
  );
}
