import { useEffect, useMemo, useRef, useState } from "react";

type JoinGuideState = "idle" | "engaged" | "loading" | "success" | "error";

type Props = {
  state: JoinGuideState;
  nickname?: string;
};

const MAO_MODEL_URL =
  "https://raw.githubusercontent.com/Live2D/CubismWebSamples/b1de66b0b1f1cb881d95fb6158622aeb6a2827bd/Samples/Resources/Mao/Mao.model3.json";

function guideCopy(state: JoinGuideState, nickname?: string) {
  if (state === "success") return "Амжилттай! Хүсэлтийг хүлээн авлаа.";
  if (state === "loading") return "Хүсэлтийг аюулгүй дамжуулж байна…";
  if (state === "error") return "Илгээхэд асуудал гарлаа. Мэдээллээ шалгаад дахин оролдоорой.";
  if (state === "engaged") return `${nickname?.trim() || "Rider"}, анкетаа үргэлжлүүлээрэй.`;
  return "ONI & KISHIN-д нэгдэхэд бэлэн үү?";
}

export function NiziiroJoinCharacter({ state, nickname }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [runtime, setRuntime] = useState<"loading" | "ready" | "failed">("loading");

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
      window.setInterval(function(){ if(model&&currentState==="idle") safeMotion("Idle",tapCycle%2); },7000);
    }).catch(function(error){ console.error("[ONI Join] Niziiro Mao load failed",error); if(loading) loading.textContent="LIVE2D OFFLINE"; send("failed"); });
  }catch(error){ console.error("[ONI Join] Live2D init failed",error); if(loading) loading.textContent="LIVE2D OFFLINE"; send("failed"); }
})();
</script>
</body>
</html>`,
    [],
  );

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
      { source: "oni-join-parent", type: "state", state },
      "*",
    );
  }, [state, runtime]);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/20 shadow-2xl shadow-crimson/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,rgba(255,68,110,0.18),transparent_52%)]" />
      <div className="pointer-events-none absolute inset-x-5 top-4 z-10 flex items-center justify-between text-[0.58rem] font-semibold tracking-[0.2em] text-white/55">
        <span>NIZIIRO MAO / LIVE2D</span>
        <span className={runtime === "ready" ? "text-emerald-300/80" : runtime === "failed" ? "text-crimson" : "text-white/40"}>
          {runtime === "ready" ? "ONLINE" : runtime === "failed" ? "OFFLINE" : "SYNC"}
        </span>
      </div>

      <iframe
        ref={frameRef}
        title="Niziiro Mao Live2D join guide"
        srcDoc={srcDoc}
        className="relative z-[1] block h-[360px] w-full border-0 sm:h-[430px] lg:h-[500px]"
        onLoad={() =>
          frameRef.current?.contentWindow?.postMessage(
            { source: "oni-join-parent", type: "state", state },
            "*",
          )
        }
      />

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">
        <p className="text-xs leading-relaxed text-white/88">{guideCopy(state, nickname)}</p>
        <p className="mt-1 text-[0.6rem] tracking-[0.14em] text-white/40">ДҮР ДЭЭР ДАРЖ REACTION ҮЗЭЭРЭЙ</p>
      </div>
    </div>
  );
}
