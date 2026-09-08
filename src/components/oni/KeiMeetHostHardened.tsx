import { useEffect, useMemo, useRef, useState } from "react";

import type { MeetLifecycle } from "@/data/meet";

type RegistrationState = "idle" | "sending" | "denied" | "registered";
type CountdownPhase = "none" | "ten" | "five" | "one" | "final10" | "go";
type RuntimeState = "loading" | "ready" | "failed";
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
type KeiMessage = { source?: string; type?: string };

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
  bridge: [
    `${VENDOR_BASE}/cubism4.min.js`,
    "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js",
  ],
};
const KEI_MODEL_URLS = [
  `${VENDOR_BASE}/kei/kei_basic_free.model3.json`,
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
function mode(state: HostState, phase: CountdownPhase, seconds: number) {
  if (phase !== "none") {
    if (phase === "ten") return "T-10 MIN";
    if (phase === "five") return "T-5 MIN";
    if (phase === "one") return "T-1 MIN";
    if (phase === "final10") return `T-${String(Math.max(1, seconds)).padStart(2, "0")}`;
    if (phase === "go") return "GO LIVE";
  }
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
function copy(
  state: HostState,
  phase: CountdownPhase,
  seconds: number,
  nickname?: string,
  notice?: string,
) {
  const rider = nickname?.trim() || "Rider";
  if (phase === "ten")
    return "ONI MEET эхлэхэд 10 минут хүрэхгүй үлдлээ. Rider-ууд бэлэн байгаарай.";
  if (phase === "five") return "5 минут. Crew check дуусгаж, Meet-д ороход бэлэн байгаарай.";
  if (phase === "one") return "1 минут. ONI MEET launch sequence эхэллээ.";
  if (phase === "final10") return `${Math.max(1, seconds)}… ONI MEET эхлэх гэж байна.`;
  if (phase === "go") return "GO LIVE — ONI MEET эхэллээ. Room access-аа шалгаарай.";
  if (state === "access")
    return `${rider}, ROOM ID ба PASSWORD бэлэн боллоо. Meet access хэсгээс аваарай.`;
  if (state === "registered")
    return `${rider}, бүртгэл баталгаажлаа. Room access бэлэн болмогц Kei мэдэгдэнэ.`;
  if (state === "denied")
    return notice?.trim() || "Бүртгэл баталгаажаагүй. Мэдээллээ шалгаад дахин оролдоорой.";
  if (state === "live") return "ONI MEET эхэллээ. Бүртгүүлсэн Rider бол room access-аа шалгаарай.";
  if (state === "starting") return "ONI MEET удахгүй эхэлнэ. Бүртгэлээ одоо баталгаажуулаарай.";
  if (state === "open") return "Бүртгэл нээлттэй. Crew аккаунтаа баталгаажуулаад нэгдээрэй.";
  if (state === "scheduled") return "Дараагийн ONI MEET товлогдсон. Countdown-аа шалгаарай.";
  if (state === "full") return "Meet дүүрсэн байна. Дараагийн мэдээллийг эндээс хүлээнэ үү.";
  if (state === "closed") return "Энэ Meet-ийн бүртгэл хаагдсан байна.";
  if (state === "loading") return "Crew мэдээлэл болон Meet slot-ийг шалгаж байна…";
  return "Kei дараагийн ONI MEET-ийг хүлээж байна.";
}

export function KeiMeetHostHardened({
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
  const watchdogRef = useRef<number | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>("loading");
  const [frameKey, setFrameKey] = useState(0);
  const state = resolveHostState(life, registrationState, accessReady);
  const countdownActive =
    countdownPhase !== "none" && state !== "access" && state !== "loading" && state !== "denied";
  const reactionState = countdownActive ? `countdown-${countdownPhase}` : state;
  const label = mode(state, countdownActive ? countdownPhase : "none", countdownSeconds);
  const message = copy(
    state,
    countdownActive ? countdownPhase : "none",
    countdownSeconds,
    nickname,
    notice,
  );
  const hot = countdownActive || state === "access" || state === "live" || state === "starting";
  const positive = state === "access" || state === "registered";

  const srcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body,#stage{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%}#loading{position:absolute;inset:0;display:grid;place-items:center;font:600 8px/1.2 system-ui;letter-spacing:.22em;color:rgba(255,255,255,.26)}</style></head><body><div id="stage"></div><div id="loading">KEI // LINKING</div><script>(function(){
var R=${JSON.stringify(RUNTIME_URLS)},M=${JSON.stringify(KEI_MODEL_URLS)},SOURCE='oni-kei-meet',PARENT='oni-kei-meet-parent',stage=document.getElementById('stage'),loading=document.getElementById('loading');
var app=null,model=null,observer=null,resizeRaf=0,idleTimer=0,currentState='idle',disposed=false,reduce=matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function send(type){try{parent.postMessage({source:SOURCE,type:type},'*')}catch(e){}}
function loadScript(urls,ready,label){return new Promise(function(resolve,reject){var i=0;function next(){if(disposed)return reject(new Error('disposed'));if(ready())return resolve();if(i>=urls.length)return reject(new Error(label+' unavailable'));var s=document.createElement('script'),done=false,t=setTimeout(function(){if(done)return;done=true;try{s.remove()}catch(e){}next()},7000);s.src=urls[i++];s.async=false;s.onload=function(){if(done)return;done=true;clearTimeout(t);ready()?resolve():next()};s.onerror=function(){if(done)return;done=true;clearTimeout(t);try{s.remove()}catch(e){}next()};document.head.appendChild(s)}next()})}
function motionCount(){try{var defs=model&&model.internalModel&&model.internalModel.motionManager&&model.internalModel.motionManager.definitions;var list=defs&&defs[''];return Array.isArray(list)?list.length:0}catch(e){return 0}}
function motion(i){if(reduce||!model||typeof model.motion!=='function')return;var n=motionCount();if(n)try{model.motion('',Math.abs(i||0)%n,3)}catch(e){}}
function focus(x,y,instant){if(model&&typeof model.focus==='function')try{model.focus(x,y,!!instant)}catch(e){}}
function apply(next,force){if(!force&&next===currentState&&next!=='countdown-final10')return;currentState=next||'idle';if(!model)return;if(currentState==='countdown-ten'){focus(.08,-.08,false);motion(1);return}if(currentState==='countdown-five'){focus(.2,-.12,true);motion(2);return}if(currentState==='countdown-one'){focus(.34,-.16,true);motion(3);return}if(currentState==='countdown-final10'){focus(.48,-.2,true);return}if(currentState==='countdown-go'||currentState==='access'){focus(.58,-.2,true);motion(0);return}if(currentState==='registered'){focus(-.28,-.08,true);motion(1);return}if(currentState==='live'){focus(.44,-.12,true);motion(2);return}if(currentState==='starting'||currentState==='open'){focus(.12,-.08,true);motion(3);return}if(currentState==='denied'||currentState==='full'||currentState==='closed'){focus(-.3,.16,false);return}focus(0,-.02,false)}
function fit(){resizeRaf=0;if(!app||!model||disposed)return;var w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);app.renderer.resize(w,h);model.scale.set(1);var bw=Math.max(model.width,1),bh=Math.max(model.height,1),n=w<520,scale=Math.min(w*(n?1.05:.98)/bw,h*(n?1.02:.98)/bh);model.scale.set(scale);model.position.set(w*(n?.515:.505),h*(n?.535:.515));model.alpha=1;model.visible=true;model.renderable=true;try{app.renderer.render(app.stage)}catch(e){}}
function queueFit(){if(!resizeRaf&&!disposed)resizeRaf=requestAnimationFrame(fit)}
function loadModel(i){if(i>=M.length)return Promise.reject(new Error('Kei model unavailable'));return PIXI.live2d.Live2DModel.from(M[i],{autoInteract:false,autoUpdate:true}).catch(function(err){console.warn('[Kei] source failed',M[i],err);return loadModel(i+1)})}
function interact(){if(!model)return;focus((Math.random()-.5)*.7,-.1,false);motion(Math.floor(Math.random()*4))}
window.addEventListener('message',function(e){var d=e.data;if(!d||d.source!==PARENT)return;if(d.type==='state')apply(d.state,false);if(d.type==='interact')interact()});
document.addEventListener('visibilitychange',function(){if(!app||!app.ticker)return;try{if(document.hidden)app.ticker.stop();else{app.ticker.start();queueFit();apply(currentState,true)}}catch(e){}});
(async function(){try{await loadScript(R.pixi,function(){return !!(window.PIXI&&PIXI.Application)},'Pixi');await loadScript(R.core,function(){return !!window.Live2DCubismCore},'Cubism');await loadScript(R.bridge,function(){return !!(window.PIXI&&PIXI.live2d&&PIXI.live2d.Live2DModel)},'Live2D');if(PIXI.live2d.config){PIXI.live2d.config.sound=false;PIXI.live2d.config.motionSync=false}if(typeof PIXI.live2d.Live2DModel.registerTicker==='function')PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);var mobile=innerWidth<640;app=new PIXI.Application({transparent:true,antialias:!mobile,autoStart:true,resolution:Math.min(devicePixelRatio||1,mobile?1:1.5),autoDensity:true,powerPreference:mobile?'low-power':'high-performance'});if(app.ticker){app.ticker.maxFPS=mobile?30:60;app.ticker.minFPS=20}stage.appendChild(app.view);app.view.addEventListener('webglcontextlost',function(ev){try{ev.preventDefault()}catch(e){}send('failed')});model=await loadModel(0);if(disposed)return;model.anchor.set(.5,.5);app.stage.addChild(model);fit();requestAnimationFrame(function(){fit();apply(currentState,true)});setTimeout(fit,200);setTimeout(fit,700);if('ResizeObserver'in window){observer=new ResizeObserver(queueFit);observer.observe(stage)}else addEventListener('resize',queueFit,{passive:true});if(loading)loading.remove();send('ready');if(!reduce)idleTimer=setInterval(function(){if(model&&!document.hidden&&(currentState==='idle'||currentState==='scheduled'))focus(Math.sin(Date.now()/5200)*.14,-.035,false)},4200)}catch(err){console.error('[Kei] boot failed',err);if(loading)loading.textContent='KEI // VISUAL OFFLINE';send('failed')}})();
addEventListener('beforeunload',function(){disposed=true;if(resizeRaf)cancelAnimationFrame(resizeRaf);if(idleTimer)clearInterval(idleTimer);if(observer)observer.disconnect();removeEventListener('resize',queueFit);try{if(model)model.destroy({children:true,texture:true,baseTexture:true})}catch(e){}try{if(app)app.destroy(true,{children:true,texture:true,baseTexture:true})}catch(e){}});
})();</script></body></html>`,
    [],
  );

  useEffect(() => {
    const armWatchdog = () => {
      if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
      watchdogRef.current = window.setTimeout(
        () => setRuntime((value) => (value === "ready" ? value : "failed")),
        18000,
      );
    };
    armWatchdog();
    const onMessage = (event: MessageEvent<KeiMessage>) => {
      if (event.source !== frameRef.current?.contentWindow || event.data?.source !== "oni-kei-meet")
        return;
      if (event.data.type === "ready") {
        retryRef.current = 0;
        if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
        setRuntime("ready");
      }
      if (event.data.type === "failed") setRuntime("failed");
    };
    window.addEventListener("message", onMessage);
    return () => {
      if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
      window.removeEventListener("message", onMessage);
    };
  }, [frameKey]);

  useEffect(() => {
    if (runtime !== "failed" || retryRef.current >= 3) return;
    const delays = [1400, 3000, 6000];
    const retry = () => {
      retryRef.current += 1;
      setRuntime("loading");
      setFrameKey((value) => value + 1);
    };
    const timer = window.setTimeout(retry, delays[retryRef.current] ?? 6000);
    window.addEventListener("online", retry, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [runtime]);

  useEffect(() => {
    if (runtime !== "ready") return;
    frameRef.current?.contentWindow?.postMessage(
      { source: "oni-kei-meet-parent", type: "state", state: reactionState },
      "*",
    );
  }, [reactionState, runtime]);

  const interact = () => {
    if (runtime === "ready")
      frameRef.current?.contentWindow?.postMessage(
        { source: "oni-kei-meet-parent", type: "interact" },
        "*",
      );
  };

  return (
    <div
      onPointerDown={interact}
      className={`relative h-full min-h-0 overflow-hidden border bg-black/55 shadow-[0_24px_80px_rgba(0,0,0,0.62)] clip-notch ${positive ? "border-emerald-400/25" : hot ? "border-crimson/35" : "border-white/10"}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_70%,rgba(195,18,45,0.22),rgba(39,4,11,0.08)_35%,transparent_70%)]" />
      {hot ? (
        <div className="pointer-events-none absolute left-1/2 top-[48%] h-[42%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-crimson/10 shadow-[0_0_80px_rgba(225,29,72,0.12)] motion-safe:animate-pulse" />
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
            {label}
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/8 bg-black/30 px-2 py-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${runtime === "ready" ? "bg-emerald-300" : runtime === "failed" ? "bg-crimson" : "bg-white/30"}`}
        />
        <span className="text-[0.42rem] font-semibold tracking-[0.16em] text-white/45">
          {runtime === "ready" ? "LINKED" : runtime === "failed" ? "OFFLINE" : "SYNC"}
        </span>
      </div>
      <iframe
        key={frameKey}
        ref={frameRef}
        title="Kei Live2D Meet host"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
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
          KEI VISUAL OFFLINE · RETRYING
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 rounded-xl border border-white/8 bg-black/58 px-3 py-2.5 backdrop-blur-md sm:inset-x-3 sm:bottom-3 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div
              className={`mb-1 text-[0.4rem] font-semibold tracking-[0.2em] ${positive ? "text-emerald-300/75" : hot ? "text-crimson/80" : "text-white/30"}`}
            >
              {hot ? "LIVE HOST SIGNAL" : "HOST LINK STANDBY"}
            </div>
            <p className="line-clamp-2 text-[0.58rem] leading-relaxed text-white/82 sm:text-[0.67rem]">
              {message}
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
    </div>
  );
}
