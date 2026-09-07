import { useEffect, useMemo, useRef, useState } from "react";

import type { MeetLifecycle } from "@/data/meet";

type RegistrationState = "idle" | "sending" | "denied" | "registered";
type HostState =
  | "idle"
  | "scheduled"
  | "starting"
  | "open"
  | "live"
  | "loading"
  | "registered"
  | "access"
  | "denied"
  | "full"
  | "closed";

type Props = {
  life: MeetLifecycle;
  registrationState: RegistrationState;
  accessReady?: boolean;
  notice?: string;
  nickname?: string;
  participants: number;
  capacity: number | null;
};

type RuntimeState = "loading" | "ready" | "failed";

type KeiMessage = {
  source?: string;
  type?: string;
};

const KEI_MODEL_URLS = [
  "https://raw.githubusercontent.com/zou-hong-run/ai-xiaoyou-web/39fe1a76517416c503a74caf8efb46e477dd95ce/public/model/kei_zh/kei_basic_free.model3.json",
  "https://raw.githubusercontent.com/NathanCavallier/alice_ai/628e96197bbcd02273f9af50d749df17c34c6137/web/public/assets/live2d_models/kei_basic_free/kei_basic_free.model3.json",
];

function resolveHostState(
  life: MeetLifecycle,
  registrationState: RegistrationState,
  accessReady: boolean,
): HostState {
  if (registrationState === "registered" && accessReady) return "access";
  if (registrationState === "registered") return "registered";
  if (registrationState === "sending") return "loading";
  if (registrationState === "denied") return "denied";
  if (life === "active") return "live";
  if (life === "starting_soon") return "starting";
  if (life === "open") return "open";
  if (life === "scheduled") return "scheduled";
  if (life === "full") return "full";
  if (life === "closed" || life === "ended") return "closed";
  return "idle";
}

function hostCopy(state: HostState, nickname?: string, notice?: string) {
  const rider = nickname?.trim() || "Rider";
  if (state === "access")
    return `${rider}, ROOM ID ба PASSWORD бэлэн боллоо. Доорх Meet access хэсгээс аваарай.`;
  if (state === "registered")
    return `${rider}, бүртгэл баталгаажлаа. Room access бэлэн болмогц Kei энд автоматаар мэдэгдэнэ.`;
  if (state === "denied")
    return notice?.trim() || "Бүртгэл баталгаажаагүй. Мэдээллээ шалгаад дахин оролдоорой.";
  if (state === "loading") return "Crew мэдээлэл болон Meet slot-ийг шалгаж байна…";
  if (state === "live") return "ONI MEET эхэллээ. Бүртгүүлсэн Rider бол room access-аа шалгаарай.";
  if (state === "starting") return "ONI MEET удахгүй эхэлнэ. Бүртгэлээ одоо баталгаажуулаарай.";
  if (state === "open") return "Бүртгэл нээлттэй. Crew аккаунтаа баталгаажуулаад нэгдээрэй.";
  if (state === "scheduled") return "Дараагийн ONI MEET товлогдсон. Бүртгэл болон countdown-аа шалгаарай.";
  if (state === "full") return "Meet дүүрсэн байна. Дараагийн мэдээллийг эндээс хүлээнэ үү.";
  if (state === "closed") return "Энэ Meet-ийн бүртгэл хаагдсан байна.";
  return "Kei дараагийн ONI MEET-ийг хүлээж байна.";
}

function hostModeLabel(state: HostState) {
  if (state === "access") return "ACCESS READY";
  if (state === "registered") return "RIDER VERIFIED";
  if (state === "denied") return "VERIFY FAILED";
  if (state === "loading") return "VERIFYING";
  if (state === "live") return "MEET LIVE";
  if (state === "starting") return "STARTING SOON";
  if (state === "open") return "REGISTRATION OPEN";
  if (state === "scheduled") return "MEET SCHEDULED";
  if (state === "full") return "CAPACITY FULL";
  if (state === "closed") return "REGISTRATION CLOSED";
  return "STANDBY";
}

export function RenMeetHost({
  life,
  registrationState,
  accessReady = false,
  notice,
  nickname,
  participants,
  capacity,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>("loading");
  const hostState = resolveHostState(life, registrationState, accessReady);
  const modeLabel = hostModeLabel(hostState);

  const srcDoc = useMemo(
    () => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
body{touch-action:pan-y}
#stage{position:absolute;inset:0;overflow:hidden}
canvas{display:block;width:100%;height:100%;touch-action:pan-y}
#loading{position:absolute;inset:0;display:grid;place-items:center;font:600 8px/1.2 system-ui;letter-spacing:.22em;color:rgba(255,255,255,.28)}
</style>
</head>
<body>
<div id="stage"></div>
<div id="loading">KEI // LIVE2D SYNC</div>
<script src="https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js"></script>
<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js"></script>
<script>
(function(){
  var MODEL_URLS=${JSON.stringify(KEI_MODEL_URLS)};
  var SOURCE='oni-kei-meet';
  var PARENT_SOURCE='oni-kei-meet-parent';
  var stage=document.getElementById('stage');
  var loading=document.getElementById('loading');
  var app=null;
  var model=null;
  var observer=null;
  var currentState='idle';
  var idleTimer=0;
  var disposed=false;
  var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function send(type){
    try{ parent.postMessage({source:SOURCE,type:type},'*'); }catch(e){}
  }

  function motionCount(){
    try{
      var defs=model&&model.internalModel&&model.internalModel.motionManager&&model.internalModel.motionManager.definitions;
      var list=defs&&defs[''];
      return Array.isArray(list)?list.length:0;
    }catch(e){ return 0; }
  }

  function safeMotion(preferredIndex){
    if(reduceMotion||!model||typeof model.motion!=='function') return;
    var count=motionCount();
    if(count<1) return;
    var index=Math.abs(preferredIndex||0)%count;
    try{ model.motion('',index,3); }catch(e){}
  }

  function safeFocus(x,y,instant){
    if(!model||typeof model.focus!=='function') return;
    try{ model.focus(x,y,!!instant); }catch(e){}
  }

  function applyState(next){
    currentState=next||'idle';
    if(!model) return;

    if(currentState==='access'){
      safeFocus(.55,-.18,true);
      safeMotion(0);
      return;
    }
    if(currentState==='registered'){
      safeFocus(-.35,-.08,true);
      safeMotion(1);
      return;
    }
    if(currentState==='live'){
      safeFocus(.4,-.12,true);
      safeMotion(2);
      return;
    }
    if(currentState==='open'||currentState==='starting'){
      safeFocus(0,-.05,false);
      safeMotion(3);
      return;
    }
    if(currentState==='loading'){
      safeFocus(.18,.08,false);
      return;
    }
    if(currentState==='denied'||currentState==='full'||currentState==='closed'){
      safeFocus(-.3,.16,false);
      return;
    }
    safeFocus(0,0,false);
  }

  function fit(){
    if(!app||!model||disposed) return;
    var w=Math.max(1,stage.clientWidth);
    var h=Math.max(1,stage.clientHeight);
    app.renderer.resize(w,h);

    model.scale.set(1);
    var baseW=Math.max(model.width,1);
    var baseH=Math.max(model.height,1);
    var mobile=w<520;
    var scale=Math.min((w*(mobile?.98:.94))/baseW,(h*(mobile?.98:.95))/baseH);

    model.scale.set(scale);
    model.x=w*.5;
    model.y=h*(mobile?.51:.5);
  }

  function loadModelAt(index){
    if(disposed) return Promise.reject(new Error('disposed'));
    if(index>=MODEL_URLS.length) return Promise.reject(new Error('Kei model sources unavailable'));
    return PIXI.live2d.Live2DModel.from(MODEL_URLS[index],{autoInteract:false}).catch(function(error){
      console.warn('[ONI Meet] Kei source failed',MODEL_URLS[index],error);
      return loadModelAt(index+1);
    });
  }

  window.addEventListener('message',function(event){
    var data=event.data;
    if(!data||data.source!==PARENT_SOURCE||data.type!=='state') return;
    applyState(data.state);
  });

  document.addEventListener('visibilitychange',function(){
    if(!app||!app.ticker) return;
    try{
      if(document.visibilityState==='hidden') app.ticker.stop();
      else{
        app.ticker.start();
        requestAnimationFrame(fit);
      }
    }catch(e){}
  });

  function fail(error){
    console.error('[ONI Meet] Kei Live2D failed',error);
    if(loading) loading.textContent='KEI // VISUAL OFFLINE';
    send('failed');
  }

  try{
    if(!window.PIXI||!PIXI.Application||!PIXI.live2d||!PIXI.live2d.Live2DModel){
      throw new Error('Cubism runtime unavailable');
    }
    if(PIXI.live2d.config){
      PIXI.live2d.config.sound=false;
      PIXI.live2d.config.motionSync=false;
    }

    app=new PIXI.Application({
      transparent:true,
      antialias:true,
      autoStart:true,
      resolution:Math.min(window.devicePixelRatio||1,window.innerWidth<640?1.25:1.6),
      autoDensity:true
    });
    stage.appendChild(app.view);

    loadModelAt(0).then(function(loaded){
      if(disposed){
        try{ loaded.destroy({children:true,texture:true,baseTexture:true}); }catch(e){}
        return;
      }
      model=loaded;
      model.anchor.set(.5,.5);
      model.scale.set(1);
      app.stage.addChild(model);
      fit();
      observer=new ResizeObserver(fit);
      observer.observe(stage);
      applyState(currentState);
      if(loading) loading.remove();
      send('ready');

      idleTimer=window.setInterval(function(){
        if(!model||document.visibilityState==='hidden') return;
        if(currentState==='idle'||currentState==='scheduled') safeFocus(Math.sin(Date.now()/5000)*.12,-.02,false);
      },4000);
    }).catch(fail);
  }catch(error){
    fail(error);
  }

  window.addEventListener('beforeunload',function(){
    disposed=true;
    if(idleTimer) window.clearInterval(idleTimer);
    if(observer) observer.disconnect();
    try{ if(model) model.destroy({children:true,texture:true,baseTexture:true}); }catch(e){}
    try{ if(app) app.destroy(true,{children:true,texture:true,baseTexture:true}); }catch(e){}
    model=null;
    app=null;
  });
})();
</script>
</body>
</html>`,
    [],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent<KeiMessage>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.source !== "oni-kei-meet") return;
      if (event.data.type === "ready") setRuntime("ready");
      if (event.data.type === "failed") setRuntime("failed");
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (runtime !== "ready") return;
    frameRef.current?.contentWindow?.postMessage(
      {
        source: "oni-kei-meet-parent",
        type: "state",
        state: hostState,
      },
      "*",
    );
  }, [hostState, runtime]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden border border-crimson/20 bg-black/48 shadow-[0_20px_70px_rgba(0,0,0,0.55)] clip-notch">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(90,0,12,0.18),transparent_34%,rgba(0,0,0,0.12)_58%,rgba(90,0,12,0.12))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_52%_64%,rgba(210,26,48,0.24),rgba(70,5,14,0.08)_35%,transparent_68%)]" />
      <div className="pointer-events-none absolute inset-x-[10%] bottom-[3.35rem] h-px bg-gradient-to-r from-transparent via-crimson/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-[20%] bottom-[3.05rem] h-7 bg-crimson/15 blur-2xl" />
      <div className="pointer-events-none absolute -right-12 top-[20%] h-40 w-40 rotate-12 border border-crimson/10 bg-crimson/5 blur-sm" />

      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 sm:left-4">
        <span className="border-l-2 border-crimson/70 pl-2 text-[0.5rem] font-semibold tracking-[0.2em] text-white/70 sm:text-[0.55rem]">
          MEET HOST // KEI
        </span>
        <span className="hidden border border-white/10 bg-black/40 px-1.5 py-0.5 text-[0.4rem] tracking-[0.16em] text-white/35 sm:inline">
          {modeLabel}
        </span>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 sm:right-4">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            runtime === "ready"
              ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]"
              : runtime === "failed"
                ? "bg-crimson"
                : "bg-white/30"
          }`}
        />
        <span
          className={`text-[0.48rem] font-semibold tracking-[0.17em] ${
            runtime === "ready" ? "text-emerald-300/90" : runtime === "failed" ? "text-crimson" : "text-white/35"
          }`}
        >
          {runtime === "ready" ? "ONLINE" : runtime === "failed" ? "OFFLINE" : "SYNC"}
        </span>
      </div>

      <iframe
        ref={frameRef}
        title="Kei Live2D Meet host"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        className="pointer-events-none absolute inset-x-0 bottom-1 top-6 h-[calc(100%_-_1.75rem)] w-full border-0 bg-transparent"
        onLoad={() => setRuntime("loading")}
      />

      {runtime === "loading" ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[0.48rem] tracking-[0.22em] text-white/30">
          SUMMONING KEI…
        </div>
      ) : null}
      {runtime === "failed" ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[0.48rem] tracking-[0.22em] text-white/30">
          KEI VISUAL OFFLINE
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/82 to-transparent px-3 pb-3 pt-12 sm:px-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[0.42rem] tracking-[0.2em] text-crimson/75 sm:text-[0.46rem]">
              <span>ONI // SECTOR 05</span>
              <span className="h-px w-8 bg-crimson/35" />
              <span>{modeLabel}</span>
            </div>
            <p className="max-w-[84%] text-[0.61rem] leading-relaxed text-white/88 sm:text-[0.68rem]">
              {hostCopy(hostState, nickname, notice)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[0.72rem] font-semibold tracking-[0.08em] text-white/80 sm:text-[0.78rem]">
              {participants}/{capacity ?? "∞"}
            </div>
            <div className="mt-0.5 text-[0.4rem] tracking-[0.18em] text-white/30">RIDERS</div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-1.5 top-1/2 z-20 -translate-y-1/2 rotate-90 text-[0.36rem] tracking-[0.28em] text-white/15">
        ONI // ALWAYS-ON KEI
      </div>
      <span className="pointer-events-none absolute left-0 top-0 h-7 w-px bg-crimson/70" />
      <span className="pointer-events-none absolute left-0 top-0 h-px w-7 bg-crimson/70" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-7 w-px bg-crimson/45" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-px w-7 bg-crimson/45" />
    </div>
  );
}
