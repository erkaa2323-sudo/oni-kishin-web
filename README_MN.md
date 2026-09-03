# ONI AI V9 Backend

Энэ нь GitHub Pages дээр ажилладаг ONI AI frontend-д зориулсан secure backend.

## Яагаад backend хэрэгтэй вэ?
OpenAI secret API key-г GitHub Pages-ийн HTML/JS дотор хийж болохгүй.
Энэ Worker дээр `OPENAI_API_KEY` secret хэлбэрээр хадгална.

## Deploy
1. Cloudflare account → Workers & Pages → Create Worker.
2. Энэ folder-ийг deploy хийнэ.
3. Secret нэм:
   `OPENAI_API_KEY = <өөрийн OpenAI API key>`
4. `wrangler deploy`
5. Гарсан Worker URL-ээ ONI frontend-ийн:
   `window.ONI_AI_CONFIG = { endpoint: "https://YOUR-WORKER.workers.dev" }`
   гэж тохируулна.

## ONI AI V9
- Ерөнхий multi-turn conversation
- Монгол хэлний personality
- Conversation history
- Firebase members / garage / music / meet tools
- Web search tool
- Unknown facts дээр hallucination хийхгүй байх policy
- OpenAI key server-side
- Tool calling

## ONI HUB V3 Stage 4B-2 визуал дүрэм
- `/v2` app нь нэг холбоотой ONI world байх бөгөөд route бүр өөр location шиг мэдрэмж өгөх ёстой: Home = ONI CITY, Members = ONI CREW HQ, Garage = ONI UNDERGROUND GARAGE, ONI AI = ONI AI CHAMBER, Meet = ONI NIGHT EVENT ARENA, Join = ONI RECRUITMENT GATE.
- Ambient layer нь нэг reusable системээр ажиллана: haze, skyline, structure, street glow, particles, rain/light streak зэрэг давхаргуудыг route бүр intensity-ээр тохируулна.
- Motion нь хөнгөн CSS transform/opacity дээр суурилна; route transition хурдан, reduced-motion үед parallax болон continuous ambience буурна эсвэл унтарна.
- UI нь Mongolian-first хэвээр байна; брэнд үгс болох ONI, KISHIN, ONI AI, JDM, MEET зэргийг л англи хэлбэрээр үлдээнэ.
- ONI AI 4B-1 motion architecture-г хадгална; production illustration asset байхгүй үед fallback rig үнэн зөвөөр тэмдэглэгдэж, asset slot strategy-г ашиглана.
- PWA cache-г визуал stage бүртэй уялдуулан version bump хийж хуучин CSS/JS mismatch-ээс сэргийлнэ.
- Performance чиглэл: WebGL/video-оос зайлсхийж, CSS/SVG/pseudo-element ambient, lazy image, low-cost shadows/light sweep ашиглана.
