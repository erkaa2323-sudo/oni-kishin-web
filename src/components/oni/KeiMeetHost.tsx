import { useEffect, useMemo, useRef, useState } from "react";

import type { MeetLifecycle } from "@/data/meet";

type RegistrationState = "idle" | "sending" | "denied" | "registered";
type CountdownPhase = "none" | "ten" | "five" | "one" | "final10" | "go";
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
  countdownPhase?: CountdownPhase;
  countdownSeconds?: number;
};

type RuntimeState = "loading" | "ready" | "failed";

type KeiMessage = {
  source?: string;
  type?: string;
};

const VENDOR_BASE = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}vendor/live2d`;

const RUNTIME_URLS = {
  pixi: [
    `${VENDOR_BASE}/pixi.min.js`,
    "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js",
  ],
  core: [
    `${VENDOR_BASE}/live2dcubismcore.js`,
    "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
  ],
  cubism4: [
    `${VENDOR_BASE}/cubism4.min.js`,
    "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js",
  ],
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
    return `${rider}, ROOM ID ба PASSWORD бэлэн боллоо. Meet access хэсгээс аваарай.`;
  if (state === "registered")
    return `${rider}, бүртгэл баталгаажлаа. Room access бэлэн болмогц Kei мэдэгдэнэ.`;
  if (state === "denied")
    return notice?.trim() || "Бүртгэл баталгаажаагүй. Мэдээллээ шалгаад дахин оролдоорой.";
  if (state === "loading") return "Crew мэдээлэл болон Meet slot-ийг шалгаж байна…";
  if (state === "live") return "ONI MEET эхэллээ. Бүртгүүлсэн Rider бол room access-аа шалгаарай.";
  if (state === "starting") return "ONI MEET удахгүй эхэлнэ. Бүртгэлээ одоо баталгаажуулаарай.";
  if (state === "open") return "Бүртгэл нээлттэй. Crew аккаунтаа баталгаажуулаад нэгдээрэй.";
  if (state === "scheduled") return "Дараагийн ONI MEET товлогдсон. Countdown-аа шалгаарай.";
  if (state === "full") return "Meet дүүрсэн байна. Дараагийн мэдээллийг эндээс хүлээнэ үү.";
  if (state === "closed") return "Энэ Meet-ийн бүртгэл хаагдсан байна.";
  return "Kei дараагийн ONI MEET-ийг хүлээж байна.";
}

function countdownCopy(phase: CountdownPhase, seconds: number) {
  if (phase === "ten")
    return "ONI MEET эхлэхэд 10 минут хүрэхгүй үлдлээ. Rider-ууд бэлэн байгаарай.";
  if (phase === "five") return "5 минут. Crew check дуусгаж, Meet-д ороход бэлэн байгаарай.";
  if (phase === "one") return "1 минут. ONI MEET launch sequence эхэллээ.";
  if (phase === "final10") return `${Math.max(1, seconds)}… ONI MEET эхлэх гэж байна.`;
  if (phase === "go") return "GO LIVE — ONI MEET эхэллээ. Room access-аа шалгаарай.";
  return "";
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

function countdownModeLabel(phase: CountdownPhase, seconds: number) {
  if (phase === "ten") return "T-10 MIN";
  if (phase === "five") return "T-5 MIN";
  if (phase === "one") return "T-1 MIN";
  if (phase === "final10") return `T-${String(Math.max(1, seconds)).padStart(2, "0")}`;
  if (phase === "go") return "GO LIVE";
  return "";
}

function hostSignal(state: HostState) {
  if (state === "access") return "SECURE CHANNEL UNLOCKED";
  if (state === "live") return "LIVE CHANNEL ACTIVE";
  if (state === "registered") return "IDENTITY VERIFIED";
  if (state === "starting") return "COUNTDOWN ACTIVE";
  if (state === "open") return "JOIN WINDOW ACTIVE";
  if (state === "loading") return "AUTHENTICATING RIDER";
  if (state === "denied") return "AUTHENTICATION REJECTED";
  if (state === "full") return "CAPACITY LIMIT REACHED";
  if (state === "closed") return "CHANNEL CLOSED";
  if (state === "scheduled") return "CHANNEL RESERVED";
  return "HOST LINK STANDBY";
}

function countdownSignal(phase: CountdownPhase) {
  if (phase === "ten") return "LAUNCH WINDOW // 10 MIN";
  if (phase === "five") return "CREW READY CHECK // 5 MIN";
  if (phase === "one") return "FINAL PREP // 1 MIN";
  if (phase === "final10") return "FINAL COUNTDOWN";
  if (phase === "go") return "ONI CHANNEL LIVE";
  return "";
}

export function KeiMeetHost({
  life,
  registrationState,
  accessReady = false,
  notice,
  nickname,
  participants,
  capacity,
  countdownPhase = "none",
  countdownSeconds = 0,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const retryRef = useRef(0);
  const [runtime, setRuntime] = useState<RuntimeState>("loading");
  const [frameKey, setFrameKey] = useState(0);

  const hostState = resolveHostState(life, registrationState, accessReady);
  const countdownActive =
    countdownPhase !== "none" &&
    hostState !== "access" &&
    hostState !== "loading" &&
    hostState !== "denied";
  const reactionState = countdownActive ? `countdown-${countdownPhase}` : hostState;
  const modeLabel = countdownActive
    ? countdownModeLabel(countdownPhase, countdownSeconds)
    : hostModeLabel(hostState);
  const signalLabel = countdownActive ? countdownSignal(countdownPhase) : hostSignal(hostState);
  const copy = countdownActive
    ? countdownCopy(countdownPhase, countdownSeconds)
    : hostCopy(hostState, nickname, notice);
  const hot =
    countdownActive || hostState === "access" || hostState === "live" || hostState === "starting";
  const positive = hostState === "access" || hostState === "registered";

  const srcDoc = useMemo(
    () => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
body{touch-action:pan-y}
#stage{position:absolute;inset:0;overflow:hidden;contain:strict}
canvas{display:block;width:100%;height:100%;touch-action:pan-y}
#loading{position:absolute;inset:0;display:grid;place-items:center;font:600 8px/1.2 system-ui;letter-spacing:.22em;color:rgba(255,255,255,.26)}
</style>
</head>
<body>
<div id="stage"></div>
<div id="loading">KEI // LINKING</div>
<script>
(function(){
  var RUNTIME_URLS=${JSON.stringify(RUNTIME_URLS)};
  var MODEL_URLS=${JSON.stringify(KEI_MODEL_URLS)};
  var SOURCE='oni-kei-meet';
  var PARENT_SOURCE='oni-kei-meet-parent';
  var stage=document.getElementById('stage');
  var loading=document.getElementById('loading');
  var app=null;
  var model=null;
  var observer=null;
  var resizeRaf=0;
  var currentState='idle';
  var idleTimer=0;
  var disposed=false;
  var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile=(window.innerWidth||0)<640;

  function send(type){
    try{ parent.postMessage({source:SOURCE,type:type},'*'); }catch(e){}
  }

  function loadScript(urls,ready,label){
    return new Promise(function(resolve,reject){
      var index=0;
      function next(){
        if(disposed) return reject(new Error('disposed'));
        if(ready()) return resolve();
        if(index>=urls.length) return reject(new Error(label+' runtime unavailable'));
        var url=urls[index++];
        var script=document.createElement('script');
        var settled=false;
        var timer=window.setTimeout(function(){
          if(settled) return;
          settled=true;
          try{script.remove();}catch(e){}
          next();
        },9000);
        script.src=url;
        script.async=false;
        script.onload=function(){
          if(settled) return;
          settled=true;
          window.clearTimeout(timer);
          if(ready()) resolve();
          else next();
        };
        script.onerror=function(){
          if(settled) return;
          settled=true;
          window.clearTimeout(timer);
          try{script.remove();}catch(e){}
          next();
        };
        document.head.appendChild(script);
      }
      next();
    });
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
    if(next===currentState&&next!=='countdown-final10') return;
    currentState=next||'idle';
    if(!model) return;

    if(currentState==='countdown-ten'){ safeFocus(.08,-.08,false); safeMotion(1); return; }
    if(currentState==='countdown-five'){ safeFocus(.2,-.12,true); safeMotion(2); return; }
    if(currentState==='countdown-one'){ safeFocus(.34,-.16,true); safeMotion(3); return; }
    if(currentState==='countdown-final10'){ safeFocus(.48,-.2,true); return; }
    if(currentState==='countdown-go'){ safeFocus(.62,-.22,true); safeMotion(2); return; }
    if(currentState==='access'){ safeFocus(.62,-.2,true); safeMotion(0); return; }
    if(currentState==='registered'){ safeFocus(-.36,-.1,true); safeMotion(1); return; }
    if(currentState==='live'){ safeFocus(.48,-.14,true); safeMotion(2); return; }
    if(currentState==='starting'){ safeFocus(.12,-.1,true); safeMotion(3); return; }
    if(currentState==='open'){ safeFocus(0,-.04,false); safeMotion(3); return; }
    if(currentState==='loading'){ safeFocus(.22,.08,false); return; }
    if(currentState==='denied'||currentState==='full'||currentState==='closed'){
      safeFocus(-.34,.18,false);
      return;
    }
    safeFocus(0,-.02,false);
  }

  function fit(){
    resizeRaf=0;
    if(!app||!model||disposed) return;
    var w=Math.max(1,stage.clientWidth);
    var h=Math.max(1,stage.clientHeight);
    app.renderer.resize(w,h);
    model.scale.set(1);
    var baseW=Math.max(model.width,1);
    var baseH=Math.max(model.height,1);
    var narrow=w<520;
    var scale=Math.min((w*(narrow?1.05:.98))/baseW,(h*(narrow?1.02:.98))/baseH);
    model.scale.set(scale);
    model.x=w*(narrow?.515:.505);
    model.y=h*(narrow?.535:.515);
  }

  function queueFit(){
    if(resizeRaf||disposed) return;
    resizeRaf=requestAnimationFrame(fit);
  }

  function loadModelAt(index){
    if(disposed) return Promise.reject(new Error('disposed'));
    if(index>=MODEL_URLS.length) return Promise.reject(new Error('Kei model sources unavailable'));
    return PIXI.live2d.Live2DModel.from(MODEL_URLS[index],{autoInteract:false}).catch(function(error){
      console.warn('[ONI Meet] Kei source failed',MODEL_URLS[index],error);
      return loadModelAt(index+1);
    });
  }

  function fail(error){
    console.error('[ONI Meet] Kei Live2D failed',error);
    if(loading) loading.textContent='KEI // VISUAL OFFLINE';
    send('failed');
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
        queueFit();
      }
    }catch(e){}
  });

  async function boot(){
    try{
      await loadScript(RUNTIME_URLS.pixi,function(){return !!(window.PIXI&&PIXI.Application);},'Pixi');
      await loadScript(RUNTIME_URLS.core,function(){return !!window.Live2DCubismCore;},'Cubism Core');
      await loadScript(
        RUNTIME_URLS.cubism4,
        function(){return !!(window.PIXI&&PIXI.live2d&&PIXI.live2d.Live2DModel);},
        'Live2D bridge'
      );

      if(PIXI.live2d.config){
        PIXI.live2d.config.sound=false;
        PIXI.live2d.config.motionSync=false;
      }

      app=new PIXI.Application({
        transparent:true,
        antialias:!mobile,
        autoStart:true,
        resolution:Math.min(window.devicePixelRatio||1,mobile?1:1.4),
        autoDensity:true,
        powerPreference:mobile?'low-power':'high-performance'
      });
      if(app.ticker){
        app.ticker.maxFPS=mobile?30:60;
        app.ticker.minFPS=20;
      }
      stage.appendChild(app.view);

      app.view.addEventListener('webglcontextlost',function(event){
        try{event.preventDefault();}catch(e){}
        send('failed');
      });

      var loaded=await loadModelAt(0);
      if(disposed){
        try{ loaded.destroy({children:true,texture:true,baseTexture:true}); }catch(e){}
        return;
      }

      model=loaded;
      model.anchor.set(.5,.5);
      model.scale.set(1);
      app.stage.addChild(model);
      fit();

      if('ResizeObserver' in window){
        observer=new ResizeObserver(queueFit);
        observer.observe(stage);
      }else{
        window.addEventListener('resize',queueFit,{passive:true});
      }

      applyState(currentState);
      if(loading) loading.remove();
      send('ready');

      if(!reduceMotion){
        idleTimer=window.setInterval(function(){
          if(!model||document.visibilityState==='hidden') return;
          if(currentState==='idle'||currentState==='scheduled'){
            safeFocus(Math.sin(Date.now()/5200)*.14,-.035,false);
          }
        },4200);
      }
    }catch(error){
      fail(error);
    }
  }

  boot();

  window.addEventListener('beforeunload',function(){
    disposed=true;
    if(resizeRaf) cancelAnimationFrame(resizeRaf);
    if(idleTimer) window.clearInterval(idleTimer);
    if(observer) observer.disconnect();
    window.removeEventListener('resize',queueFit);
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
      if (event.data.type === "ready") {
        retryRef.current = 0;
        setRuntime("ready");
      }
      if (event.data.type === "failed") setRuntime("failed");
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (runtime !== "failed" || retryRef.current >= 2) return;
    const retry = () => {
      retryRef.current += 1;
      setRuntime("loading");
      setFrameKey((value) => value + 1);
    };
    const timer = window.setTimeout(retry, 6500);
    window.addEventListener("online", retry, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [runtime]);

  useEffect(() => {
    if (runtime !== "ready") return;
    frameRef.current?.contentWindow?.postMessage(
      {
        source: "oni-kei-meet-parent",
        type: "state",
        state: reactionState,
      },
      "*",
    );
  }, [reactionState, runtime]);

  return (
    <div
      className={`relative h-full min-h-0 overflow-hidden border bg-black/55 shadow-[0_24px_80px_rgba(0,0,0,0.62)] clip-notch transition-[border-color,box-shadow] duration-700 ${
        positive
          ? "border-emerald-400/25 shadow-[0_24px_80px_rgba(0,0,0,0.62),0_0_38px_rgba(52,211,153,0.08)]"
          : hot
            ? "border-crimson/35 shadow-[0_24px_80px_rgba(0,0,0,0.62),0_0_42px_rgba(225,29,72,0.12)]"
            : "border-white/10"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_70%,rgba(195,18,45,0.22),rgba(39,4,11,0.08)_35%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_22%,transparent_66%,rgba(0,0,0,0.8))]" />
      <div className="pointer-events-none absolute left-1/2 top-[14%] h-[58%] w-[72%] -translate-x-1/2 rounded-full bg-crimson/5 blur-3xl" />

      {hot ? (
        <div className="pointer-events-none absolute left-1/2 top-[48%] h-[42%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-crimson/10 shadow-[0_0_80px_rgba(225,29,72,0.12)] motion-safe:animate-pulse" />
      ) : null}

      {positive ? (
        <div className="pointer-events-none absolute inset-x-[18%] bottom-[14%] h-16 rounded-full bg-emerald-400/5 blur-3xl" />
      ) : null}

      <div className="pointer-events-none absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <div className="text-[0.42rem] font-semibold tracking-[0.24em] text-white/35">
          ONI // MEET HOST
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[0.64rem] font-semibold tracking-[0.26em] text-white/85 sm:text-[0.72rem]">
            KEI
          </span>
          <span className="rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[0.4rem] tracking-[0.17em] text-white/45">
            {modeLabel}
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/8 bg-black/30 px-2 py-1.5 sm:right-4 sm:top-4">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            runtime === "ready"
              ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]"
              : runtime === "failed"
                ? "bg-crimson"
                : "bg-white/30"
          }`}
        />
        <span className="text-[0.42rem] font-semibold tracking-[0.16em] text-white/45">
          {runtime === "ready" ? "LINKED" : runtime === "failed" ? "OFFLINE" : "SYNC"}
        </span>
      </div>

      <div className="pointer-events-none absolute left-3 top-[4.2rem] z-10 text-[2.35rem] font-black tracking-[-0.08em] text-white/[0.025] sm:left-4 sm:text-[3.2rem]">
        KEI
      </div>

      <iframe
        key={frameKey}
        ref={frameRef}
        title="Kei Live2D Meet host"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-transparent"
        onLoad={() => setRuntime("loading")}
      />

      {runtime === "loading" ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[0.46rem] tracking-[0.22em] text-white/25">
          LINKING KEI…
        </div>
      ) : null}
      {runtime === "failed" ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-[0.46rem] tracking-[0.22em] text-white/30">
          KEI VISUAL OFFLINE
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 rounded-xl border border-white/8 bg-black/58 px-3 py-2.5 backdrop-blur-md sm:inset-x-3 sm:bottom-3 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div
              className={`mb-1 text-[0.4rem] font-semibold tracking-[0.2em] ${
                positive ? "text-emerald-300/75" : hot ? "text-crimson/80" : "text-white/30"
              }`}
            >
              {signalLabel}
            </div>
            <p className="line-clamp-2 text-[0.58rem] leading-relaxed text-white/82 sm:text-[0.67rem]">
              {copy}
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-white/8 bg-white/[0.025] px-2.5 py-2 text-right">
            <div className="font-mono text-[0.72rem] font-semibold tracking-[0.06em] text-white/85 sm:text-[0.8rem]">
              {participants}/{capacity ?? "∞"}
            </div>
            <div className="mt-0.5 text-[0.34rem] tracking-[0.18em] text-white/28">RIDERS</div>
          </div>
        </div>
      </div>

      <span className="pointer-events-none absolute left-0 top-0 h-10 w-px bg-gradient-to-b from-crimson/70 to-transparent" />
      <span className="pointer-events-none absolute left-0 top-0 h-px w-10 bg-gradient-to-r from-crimson/70 to-transparent" />
    </div>
  );
}
