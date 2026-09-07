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
  const [runtimeError, setRuntimeError] = useState("");
  const [runtimeDiagnostic, setRuntimeDiagnostic] = useState("");
  const hostState = resolveHostState(life, registrationState);

  const srcDoc = useMemo(
    () => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;touch-action:pan-y}
#stage{position:absolute;inset:0;z-index:1}
canvas{display:block;width:100%;height:100%;touch-action:none}
#loading{position:absolute;z-index:2;left:12px;right:12px;top:50%;transform:translateY(-50%);text-align:center;font:600 9px/1.45 system-ui;letter-spacing:.18em;color:rgba(255,255,255,.48)}
</style>
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
</head>
<body>
<div id="stage"></div><div id="loading">REN / CORE 6 · MOC3 V6</div>
<script type="module">
import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@8.13.2/+esm";
import { Live2DModel } from "https://cdn.jsdelivr.net/npm/@laplace.live/pixijs-live2d@0.2.0/+esm";

(async function(){
  const MODEL_URL=${JSON.stringify(REN_MODEL_URL)};
  const EXPECTED_MOC_BYTES=915200;
  const CORE_MEMORY_BYTES=128*1024*1024;
  const stage=document.getElementById("stage");
  const loading=document.getElementById("loading");
  let app=null,model=null,currentState="idle",tapCycle=0,observer=null,diag="";
  const send=(type,error)=>parent.postMessage({source:"oni-ren-meet",type,error:error||""},"*");
  const expr=(name)=>{try{model?.expression?.(name)}catch{}};
  const motion=(group,index)=>{try{model?.motion?.(group,index)}catch{}};

  function applyState(next){
    currentState=next||"idle";
    if(!model)return;
    if(currentState==="registered"){expr("exp_05");motion("TapBody",1);return;}
    if(currentState==="loading"){expr("exp_03");return;}
    if(currentState==="live"){expr("exp_02");motion("TapBody",0);return;}
    if(currentState==="open"){expr("exp_02");return;}
    if(currentState==="full"||currentState==="closed"){expr("exp_04");return;}
    expr("exp_01");motion("Idle",0);
  }

  function fit(){
    if(!app||!model)return;
    const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
    app.renderer.resize(w,h);

    // Avoid getLocalBounds() here. Live2D's custom display object can have its
    // child bounds invalidated by that call, which is especially visible as a
    // fully transparent model on WebKit/Safari. Use the model canvas metrics.
    model.scale.set(1);
    model.anchor?.set?.(.5,.5);
    const internal=model.internalModel;
    const baseW=Math.max(Number(internal?.width)||Number(internal?.originalWidth)||Number(model.width)||1,1);
    const baseH=Math.max(Number(internal?.height)||Number(internal?.originalHeight)||Number(model.height)||1,1);
    const scale=Math.min((w*.91)/baseW,(h*.90)/baseH);
    model.scale.set(Math.max(scale,0.0001));
    model.position?.set?.(w*.5,h*.49);
    model.visible=true;
    model.renderable=true;
    model.alpha=1;
  }

  function focusAt(clientX,clientY){
    if(!model?.focus)return;
    const rect=stage.getBoundingClientRect();
    const x=((clientX-rect.left)/Math.max(rect.width,1))*2-1;
    const y=-(((clientY-rect.top)/Math.max(rect.height,1))*2-1);
    try{model.focus(Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y)))}catch{}
  }

  async function diagnoseCoreAndMoc(){
    const core=window.Live2DCubismCore;
    const bits=[];
    let memoryState="NA";

    try{
      if(core?.Memory?.initializeAmountOfMemory){
        core.Memory.initializeAmountOfMemory(CORE_MEMORY_BYTES);
        memoryState="128M";
      }
    }catch(error){
      memoryState="ERR";
      console.warn("[ONI Meet] Cubism memory reserve failed",error);
    }

    let coreVersion="?";
    let latestMoc="?";
    try{coreVersion=String(core?.Version?.csmGetVersion?.() ?? "?")}catch{}
    try{latestMoc=String(core?.Version?.csmGetLatestMocVersion?.() ?? "?")}catch{}

    const modelResponse=await fetch(MODEL_URL,{cache:"no-store"});
    if(!modelResponse.ok)throw new Error("model3 HTTP "+modelResponse.status);
    const settings=await modelResponse.json();
    const mocPath=settings?.FileReferences?.Moc;
    if(!mocPath)throw new Error("model3 Moc path missing");

    const mocUrl=new URL(mocPath,MODEL_URL).toString();
    const mocResponse=await fetch(mocUrl,{cache:"no-store"});
    if(!mocResponse.ok)throw new Error("moc3 HTTP "+mocResponse.status);
    const mocBytes=await mocResponse.arrayBuffer();
    const header=Array.from(new Uint8Array(mocBytes.slice(0,4)))
      .map((value)=>String.fromCharCode(value)).join("");

    let mocVersion="?";
    try{mocVersion=String(core?.Version?.csmGetMocVersion?.(mocBytes) ?? "?")}catch{}

    bits.push("CORE="+coreVersion);
    bits.push("MEM="+memoryState);
    bits.push("MOC="+mocBytes.byteLength);
    bits.push("MV="+mocVersion+"/"+latestMoc);
    bits.push("HDR="+header);
    diag=bits.join(" · ");
    send("diagnostic",diag);

    if(header!=="MOC3")throw new Error("invalid moc3 header "+header);
    if(mocBytes.byteLength!==EXPECTED_MOC_BYTES){
      throw new Error("moc3 bytes "+mocBytes.byteLength+" expected "+EXPECTED_MOC_BYTES);
    }
  }

  window.addEventListener("message",(event)=>{
    const data=event.data;
    if(!data||data.source!=="oni-meet-parent"||data.type!=="state")return;
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

  try{
    if(!window.Live2DCubismCore)throw new Error("Cubism Core unavailable");
    if(!PIXI?.Application)throw new Error("PixiJS unavailable");

    await diagnoseCoreAndMoc();
    if(loading)loading.textContent="REN / "+diag;

    Live2DModel.registerTicker?.(PIXI.Ticker);
    app=new PIXI.Application();
    await app.init({
      backgroundAlpha:0,
      antialias:true,
      preference:"webgl",
      resolution:Math.min(window.devicePixelRatio||1,window.innerWidth<640?1.1:1.5),
      autoDensity:true,
      autoStart:true
    });
    if(app.ticker)app.ticker.maxFPS=window.innerWidth<640?30:45;
    if(PIXI.Ticker?.shared){
      PIXI.Ticker.shared.maxFPS=window.innerWidth<640?30:45;
      PIXI.Ticker.shared.start?.();
    }
    stage.appendChild(app.canvas);

    model=await Live2DModel.from(MODEL_URL,{autoInteract:false});
    model.anchor?.set?.(.5,.5);
    model.visible=true;
    model.renderable=true;
    model.alpha=1;
    app.stage.addChild(model);
    fit();
    observer=new ResizeObserver(fit);
    observer.observe(stage);
    applyState(currentState);

    app.start?.();
    await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    fit();
    app.renderer.render(app.stage);

    const internal=model.internalModel;
    send(
      "diagnostic",
      diag+" · VIEW="+Math.round(stage.clientWidth)+"x"+Math.round(stage.clientHeight)+
      " · MODEL="+Math.round(Number(internal?.width)||Number(model.width)||0)+"x"+
      Math.round(Number(internal?.height)||Number(model.height)||0)+
      " · SCALE="+Number(model.scale?.x||0).toFixed(4),
    );

    loading?.remove();
    send("ready");

    window.setInterval(()=>{
      if(model&&currentState==="idle")motion("Idle",0);
    },8500);

    document.addEventListener("visibilitychange",()=>{
      const ticker=PIXI.Ticker?.shared;
      if(!ticker)return;
      if(document.hidden)ticker.stop();else ticker.start();
      if(!document.hidden){
        app?.start?.();
        requestAnimationFrame(()=>{
          fit();
          if(app&&model)app.renderer.render(app.stage);
        });
      }
    });
  }catch(error){
    const base=error instanceof Error?error.message:String(error);
    const message=diag?diag+" | "+base:base;
    console.error("[ONI Meet] Ren Foster init failed",error);
    if(loading)loading.textContent="REN LIVE2D OFFLINE";
    send("failed",message);
  }
})();
</script>
</body>
</html>`,
    [],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string; error?: string } | undefined;
      if (!data || data.source !== "oni-ren-meet") return;
      if (data.type === "diagnostic") {
        setRuntimeDiagnostic((data.error || "").slice(0, 220));
      }
      if (data.type === "ready") {
        setRuntime("ready");
        setRuntimeError("");
      }
      if (data.type === "failed") {
        setRuntime("failed");
        setRuntimeError((data.error || "Live2D runtime error").slice(0, 220));
      }
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
        <span
          className={
            runtime === "ready"
              ? "text-emerald-300/80"
              : runtime === "failed"
                ? "text-crimson"
                : "text-white/40"
          }
        >
          {runtime === "ready" ? "ONLINE" : runtime === "failed" ? "OFFLINE" : "SYNC"}
        </span>
      </div>

      <iframe
        ref={frameRef}
        title="Ren Foster Live2D Meet host"
        srcDoc={srcDoc}
        className="pointer-events-none absolute inset-0 h-full w-full border-0 lg:pointer-events-auto"
        onLoad={() =>
          frameRef.current?.contentWindow?.postMessage(
            { source: "oni-meet-parent", type: "state", state: hostState },
            "*",
          )
        }
      />

      {runtime === "failed" && runtimeError ? (
        <div className="pointer-events-none absolute inset-x-4 top-10 z-10 space-y-1 text-[0.48rem] leading-relaxed tracking-[0.05em] text-crimson/75">
          <div className="break-words">{runtimeError}</div>
          {runtimeDiagnostic && !runtimeError.includes(runtimeDiagnostic) ? (
            <div className="text-white/35">{runtimeDiagnostic}</div>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 border border-white/10 bg-black/60 px-3 py-2.5 backdrop-blur-xl clip-notch">
        <p className="text-[0.7rem] leading-relaxed text-white/90">{hostCopy(hostState, nickname)}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.54rem] tracking-[0.14em] text-white/40">
          <span>ALWAYS-ON HOST</span>
          <span>
            {participants}
            {capacity !== null ? ` / ${capacity}` : ""} RIDERS
          </span>
        </div>
      </div>
    </div>
  );
}
