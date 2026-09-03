import { parseMusicCommand, runMusicCommand, startMusicIntegration, stopMusicIntegration, subscribeMusicState } from "./music.js";
import { subscribeMeetWorldState } from "./meet-world.js";

const DEFAULT_AI_ENDPOINT = "https://oni-kishin-web.erkaa2323.workers.dev/api/oni-ai";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_MESSAGE_CHARS = 2000;
const HISTORY_LIMIT = 18;
const HISTORY_TEXT_LIMIT = 1200;

const EMOTIONS = new Set(["neutral", "happy", "excited", "thinking", "confused", "serious", "concerned", "sad", "sorry", "proud", "playful", "surprised", "music", "meet-live"]);
const GESTURES = new Set(["idle", "listen", "talk", "wave", "nod", "shake-head", "think", "point", "cheer", "laugh", "bow", "hands-on-hip", "surprised", "calm", "dance-subtle", "battle-ready"]);
const POSTURES = new Set(["relaxed", "attentive", "forward", "confident", "closed", "soft", "battle", "music"]);
const GAZE_TARGETS = new Set(["user", "latest-user-message", "latest-ai-message", "composer", "meet-area", "neutral-left", "neutral-right"]);
const CONVERSATION_STATES = new Set(["idle", "noticed-message", "reading", "listening", "thinking", "tool-working", "responding", "finished-speaking", "error", "music", "meet-live"]);

const EMOTION_COPY = {
  neutral: "Тайван",
  happy: "Дулаахан",
  excited: "Эрчтэй",
  thinking: "Бодож байна",
  confused: "Эргэлзэж байна",
  serious: "Төвлөрсөн",
  concerned: "Анхаарч байна",
  sad: "Зөөлөн",
  sorry: "Уучлалтай",
  proud: "Итгэлтэй",
  playful: "Сэргэлэн",
  surprised: "Гайхсан",
  music: "Хөгжимтэй",
  "meet-live": "MEET LIVE"
};

const MEET_STATE_COPY = {
  NONE: "MEET хүлээлттэй",
  UPCOMING: "MEET тун удахгүй",
  LIVE: "MEET идэвхтэй",
  FULL: "MEET дүүрсэн",
  ENDED: "MEET дууссан"
};

const POSTURE_PRESETS = {
  relaxed: { torsoTilt: -1, headTilt: -2, balanceX: -0.6, shoulderLift: 0, armLeft: -8, armRight: 8, handLeft: 4, handRight: -4, aura: 0.15 },
  attentive: { torsoTilt: -4, headTilt: -1, balanceX: -0.4, shoulderLift: 4, armLeft: -18, armRight: 18, handLeft: 10, handRight: -10, aura: 0.18 },
  forward: { torsoTilt: -7, headTilt: 0, balanceX: -0.2, shoulderLift: 6, armLeft: -16, armRight: 16, handLeft: 8, handRight: -8, aura: 0.22 },
  confident: { torsoTilt: -2, headTilt: -5, balanceX: -1.2, shoulderLift: 2, armLeft: -28, armRight: 26, handLeft: 12, handRight: -14, aura: 0.22 },
  closed: { torsoTilt: 4, headTilt: 5, balanceX: 0.4, shoulderLift: -3, armLeft: -4, armRight: 4, handLeft: 6, handRight: -6, aura: 0.12 },
  soft: { torsoTilt: 1, headTilt: 3, balanceX: 0.6, shoulderLift: -2, armLeft: -10, armRight: 10, handLeft: 6, handRight: -6, aura: 0.12 },
  battle: { torsoTilt: -6, headTilt: -4, balanceX: -1.5, shoulderLift: 8, armLeft: -34, armRight: 34, handLeft: 14, handRight: -14, aura: 0.28 },
  music: { torsoTilt: -2, headTilt: -3, balanceX: -0.8, shoulderLift: 5, armLeft: -18, armRight: 18, handLeft: 12, handRight: -12, aura: 0.24 }
};

const GESTURE_OFFSETS = {
  idle: { armLeft: 0, armRight: 0, handLeft: 0, handRight: 0, headTilt: 0, torsoTilt: 0, shoulderLift: 0, mouth: 0.12 },
  listen: { armLeft: -6, armRight: 8, handLeft: 6, handRight: -8, headTilt: 2, torsoTilt: -1, shoulderLift: 1, mouth: 0.1 },
  talk: { armLeft: -10, armRight: 14, handLeft: 10, handRight: -12, headTilt: -1, torsoTilt: -1, shoulderLift: 2, mouth: 0.48 },
  wave: { armLeft: -4, armRight: 48, handLeft: 2, handRight: -28, headTilt: -2, torsoTilt: -2, shoulderLift: 4, mouth: 0.4 },
  nod: { armLeft: -6, armRight: 6, handLeft: 4, handRight: -4, headTilt: -5, torsoTilt: -1, shoulderLift: 1, mouth: 0.28 },
  "shake-head": { armLeft: -8, armRight: 8, handLeft: 4, handRight: -4, headTilt: 6, torsoTilt: 0, shoulderLift: 0, mouth: 0.18 },
  think: { armLeft: 2, armRight: 34, handLeft: -2, handRight: -20, headTilt: 8, torsoTilt: 0, shoulderLift: 2, mouth: 0.12 },
  point: { armLeft: -12, armRight: 30, handLeft: 0, handRight: -22, headTilt: -2, torsoTilt: -3, shoulderLift: 3, mouth: 0.24 },
  cheer: { armLeft: -40, armRight: 40, handLeft: 16, handRight: -16, headTilt: -3, torsoTilt: -4, shoulderLift: 8, mouth: 0.62 },
  laugh: { armLeft: -12, armRight: 18, handLeft: 10, handRight: -12, headTilt: -3, torsoTilt: -1, shoulderLift: 5, mouth: 0.66 },
  bow: { armLeft: -10, armRight: 10, handLeft: 6, handRight: -6, headTilt: 12, torsoTilt: 9, shoulderLift: -3, mouth: 0.08 },
  "hands-on-hip": { armLeft: -42, armRight: 42, handLeft: 20, handRight: -20, headTilt: -4, torsoTilt: -1, shoulderLift: 4, mouth: 0.24 },
  surprised: { armLeft: -18, armRight: 22, handLeft: 16, handRight: -16, headTilt: -6, torsoTilt: -2, shoulderLift: 8, mouth: 0.72 },
  calm: { armLeft: -4, armRight: 4, handLeft: 2, handRight: -2, headTilt: 1, torsoTilt: 0, shoulderLift: -1, mouth: 0.14 },
  "dance-subtle": { armLeft: -20, armRight: 20, handLeft: 12, handRight: -12, headTilt: -2, torsoTilt: -2, shoulderLift: 4, mouth: 0.3 },
  "battle-ready": { armLeft: -34, armRight: 36, handLeft: 18, handRight: -18, headTilt: -3, torsoTilt: -4, shoulderLift: 8, mouth: 0.18 }
};

const EMOTION_BOOSTS = {
  neutral: { eyeOpen: 0.55, brow: 0.02, smile: 0.08, aura: 0.06 },
  happy: { eyeOpen: 0.64, brow: 0.08, smile: 0.54, aura: 0.12 },
  excited: { eyeOpen: 0.74, brow: 0.12, smile: 0.68, aura: 0.18 },
  thinking: { eyeOpen: 0.52, brow: -0.08, smile: 0.02, aura: 0.08 },
  confused: { eyeOpen: 0.57, brow: -0.16, smile: 0.02, aura: 0.08 },
  serious: { eyeOpen: 0.5, brow: -0.12, smile: -0.02, aura: 0.08 },
  concerned: { eyeOpen: 0.48, brow: -0.1, smile: -0.08, aura: 0.08 },
  sad: { eyeOpen: 0.44, brow: -0.08, smile: -0.16, aura: 0.04 },
  sorry: { eyeOpen: 0.42, brow: -0.1, smile: -0.12, aura: 0.02 },
  proud: { eyeOpen: 0.62, brow: 0.06, smile: 0.22, aura: 0.1 },
  playful: { eyeOpen: 0.66, brow: 0.04, smile: 0.44, aura: 0.12 },
  surprised: { eyeOpen: 0.82, brow: 0.18, smile: 0.18, aura: 0.16 },
  music: { eyeOpen: 0.68, brow: 0.06, smile: 0.28, aura: 0.14 },
  "meet-live": { eyeOpen: 0.7, brow: 0.12, smile: 0.16, aura: 0.18 }
};

const THINKING_VARIANTS = [
  { posture: "attentive", gesture: "think", gaze: "neutral-right", text: "Уншаад бодож байна…", intensity: 0.48 },
  { posture: "soft", gesture: "listen", gaze: "latest-user-message", text: "Тайлбарыг боловсруулж байна…", intensity: 0.42 },
  { posture: "forward", gesture: "think", gaze: "neutral-left", text: "Хариултаа цэгцэлж байна…", intensity: 0.54 }
];

const TAP_REACTIONS = [
  { emotion: "happy", gesture: "wave", posture: "confident", gaze: "user", text: "Сайн уу?" },
  { emotion: "playful", gesture: "nod", posture: "soft", gaze: "latest-ai-message", text: "🙂" },
  { emotion: "surprised", gesture: "surprised", posture: "attentive", gaze: "user", text: "Өө?" },
  { emotion: "proud", gesture: "hands-on-hip", posture: "confident", gaze: "neutral-right", text: "ONI бэлэн." }
];

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}

function aiEndpoint() {
  return asText(window.ONI_AI_CONFIG?.endpoint) || DEFAULT_AI_ENDPOINT;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampIntensity(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.45;
  return clamp(num, 0, 1);
}

function sanitizeEmotion(value) {
  const key = asText(value).toLowerCase();
  return EMOTIONS.has(key) ? key : "neutral";
}

function sanitizeGesture(value) {
  const key = asText(value).toLowerCase();
  return GESTURES.has(key) ? key : "talk";
}

function sanitizePosture(value) {
  const key = asText(value).toLowerCase();
  return POSTURES.has(key) ? key : "relaxed";
}

function sanitizeGazeTarget(value) {
  const key = asText(value).toLowerCase();
  return GAZE_TARGETS.has(key) ? key : "user";
}

function sanitizeConversationState(value) {
  const key = asText(value).toLowerCase();
  return CONVERSATION_STATES.has(key) ? key : "idle";
}

function sanitizeSources(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  for (const item of value) {
    const title = asText(item?.title).slice(0, 180);
    const url = asText(item?.url);
    if (!title || !/^https?:\/\//i.test(url)) continue;
    if (!unique.has(url)) unique.set(url, { title, url });
    if (unique.size >= 6) break;
  }
  return [...unique.values()];
}

function normalizeAiPacket(data) {
  const reply = asText(data?.text || data?.reply);
  return {
    text: reply,
    emotion: sanitizeEmotion(data?.emotion),
    gesture: sanitizeGesture(data?.gesture),
    intensity: clampIntensity(data?.intensity),
    sources: sanitizeSources(data?.sources),
    uiAction: data?.uiAction && typeof data.uiAction === "object" ? data.uiAction : null
  };
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function emotionLabel(value) {
  return EMOTION_COPY[sanitizeEmotion(value)] || EMOTION_COPY.neutral;
}

function meetStateLabel(value) {
  const key = String(value || "NONE").toUpperCase();
  return MEET_STATE_COPY[key] || MEET_STATE_COPY.NONE;
}

function stateLabel(value) {
  const key = sanitizeConversationState(value);
  if (key === "noticed-message") return "Анзаарлаа…";
  if (key === "reading") return "Уншиж байна…";
  if (key === "listening") return "Сонсож байна…";
  if (key === "thinking") return "Бодож байна…";
  if (key === "tool-working") return "Хайлт хийж байна…";
  if (key === "responding") return "Хариулж байна…";
  if (key === "finished-speaking") return "Бэлэн байна.";
  if (key === "error") return "Сэргээж байна…";
  if (key === "music") return "Хөгжим мэдэрч байна…";
  if (key === "meet-live") return "MEET анхааралд байна.";
  return "Бэлэн байна.";
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hashText(text) {
  let hash = 0;
  const source = String(text || "");
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

function fallbackPosture(emotion, gesture, conversationState) {
  if (conversationState === "music" || emotion === "music") return "music";
  if (conversationState === "meet-live" || gesture === "battle-ready" || emotion === "meet-live") return "battle";
  if (emotion === "thinking" || gesture === "think") return "attentive";
  if (emotion === "proud" || gesture === "hands-on-hip") return "confident";
  if (emotion === "sorry" || emotion === "sad" || emotion === "concerned") return "soft";
  if (conversationState === "reading" || conversationState === "listening") return "attentive";
  if (conversationState === "responding" || emotion === "excited") return "forward";
  return "relaxed";
}

function createMotionProfile({ emotion = "neutral", gesture = "idle", posture = "relaxed", intensity = 0.45, speaking = false } = {}) {
  const safeEmotion = sanitizeEmotion(emotion);
  const safeGesture = sanitizeGesture(gesture);
  const safePosture = sanitizePosture(posture);
  const safeIntensity = clampIntensity(intensity);
  const postureBase = POSTURE_PRESETS[safePosture] || POSTURE_PRESETS.relaxed;
  const gestureBase = GESTURE_OFFSETS[safeGesture] || GESTURE_OFFSETS.idle;
  const emotionBase = EMOTION_BOOSTS[safeEmotion] || EMOTION_BOOSTS.neutral;
  const swing = 0.55 + (safeIntensity * 0.7);

  return {
    "--oa-torso-tilt": `${(postureBase.torsoTilt + (gestureBase.torsoTilt * swing)).toFixed(2)}deg`,
    "--oa-head-tilt": `${(postureBase.headTilt + (gestureBase.headTilt * swing)).toFixed(2)}deg`,
    "--oa-balance-x": `${(postureBase.balanceX * (1 + safeIntensity * 0.3)).toFixed(2)}%`,
    "--oa-shoulder-lift": `${(postureBase.shoulderLift + (gestureBase.shoulderLift * swing)).toFixed(2)}px`,
    "--oa-arm-left-rot": `${(postureBase.armLeft + (gestureBase.armLeft * swing)).toFixed(2)}deg`,
    "--oa-arm-right-rot": `${(postureBase.armRight + (gestureBase.armRight * swing)).toFixed(2)}deg`,
    "--oa-hand-left-rot": `${(postureBase.handLeft + (gestureBase.handLeft * swing)).toFixed(2)}deg`,
    "--oa-hand-right-rot": `${(postureBase.handRight + (gestureBase.handRight * swing)).toFixed(2)}deg`,
    "--oa-eye-open": String(clamp(emotionBase.eyeOpen + (safeEmotion === "surprised" ? safeIntensity * 0.12 : 0), 0.32, 0.92).toFixed(2)),
    "--oa-brow-tilt": `${(emotionBase.brow * 18).toFixed(2)}deg`,
    "--oa-mouth-open": String(clamp((gestureBase.mouth * (speaking ? 1.15 : 0.66)) + (emotionBase.smile * 0.18), 0.04, 0.92).toFixed(2)),
    "--oa-smile": String(clamp(emotionBase.smile, -0.25, 0.8).toFixed(2)),
    "--oa-aura": String(clamp(postureBase.aura + emotionBase.aura + (safeIntensity * 0.18), 0.06, 0.72).toFixed(2)),
    "--oa-float": `${(safeIntensity * 4.2).toFixed(2)}px`,
    "--oa-talk-shift": `${speaking ? (1 + (safeIntensity * 2.2)).toFixed(2) : "0"}px`
  };
}

function sourceCardsMarkup(sources) {
  if (!sources.length) return "";
  return `
    <div class="oni-oa-sources">
      ${sources.map(source => `
        <a class="oni-oa-source" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
          <small>ЭХ СУРВАЛЖ</small>
          <b>${escapeHtml(source.title)}</b>
        </a>
      `).join("")}
    </div>
  `;
}

function routeMarkup() {
  return `
    <section class="oni-oa-view" data-oa-view>
      <article class="oni-card oni-oa-scene" data-oa-scene data-oa-asset="fallback">
        <div class="oni-oa-room" aria-hidden="true">
          <span class="oni-oa-room-glow"></span>
          <span class="oni-oa-room-grid"></span>
          <span class="oni-oa-room-panels"></span>
          <span class="oni-oa-room-fog"></span>
        </div>

        <div class="oni-oa-layout">
          <section class="oni-oa-stage-pane">
            <div class="oni-oa-stage" data-oa-stage data-oa-emotion="neutral" data-oa-gesture="idle" data-oa-posture="relaxed" data-oa-gaze="user" data-oa-state="idle">
              <div class="oni-oa-world" data-oa-world>
                <span class="oni-oa-aura" data-oa-aura></span>
                <span class="oni-oa-stage-mark oni-oa-stage-mark-left"></span>
                <span class="oni-oa-stage-mark oni-oa-stage-mark-right"></span>
                <button type="button" class="oni-oa-character" data-oa-character aria-label="ONI AI дүр">
                  <span class="oni-oa-layer oni-oa-part-aura-core" data-oa-part="aura"></span>
                  <span class="oni-oa-layer oni-oa-part-hair-back" data-oa-part="hair-back"></span>
                  <span class="oni-oa-layer oni-oa-part-legs" data-oa-part="legs"></span>
                  <span class="oni-oa-layer oni-oa-part-hips" data-oa-part="hips"></span>
                  <span class="oni-oa-layer oni-oa-part-torso" data-oa-part="torso"></span>
                  <span class="oni-oa-layer oni-oa-part-clothes" data-oa-part="clothes"></span>
                  <span class="oni-oa-layer oni-oa-part-accessories" data-oa-part="accessories"></span>
                  <span class="oni-oa-layer oni-oa-part-neck" data-oa-part="neck"></span>
                  <span class="oni-oa-layer oni-oa-part-shoulders" data-oa-part="shoulders"></span>
                  <span class="oni-oa-layer oni-oa-part-left-upper-arm" data-oa-part="left-upper-arm"></span>
                  <span class="oni-oa-layer oni-oa-part-left-forearm" data-oa-part="left-forearm"></span>
                  <span class="oni-oa-layer oni-oa-part-left-hand" data-oa-part="left-hand"></span>
                  <span class="oni-oa-layer oni-oa-part-right-upper-arm" data-oa-part="right-upper-arm"></span>
                  <span class="oni-oa-layer oni-oa-part-right-forearm" data-oa-part="right-forearm"></span>
                  <span class="oni-oa-layer oni-oa-part-right-hand" data-oa-part="right-hand"></span>
                  <span class="oni-oa-layer oni-oa-part-head" data-oa-part="head"></span>
                  <span class="oni-oa-layer oni-oa-part-horns" data-oa-part="horns"></span>
                  <span class="oni-oa-layer oni-oa-part-hair-front" data-oa-part="hair-front"></span>
                  <span class="oni-oa-layer oni-oa-part-eyebrows" data-oa-part="eyebrows"></span>
                  <span class="oni-oa-layer oni-oa-part-eyelids" data-oa-part="eyelids"></span>
                  <span class="oni-oa-layer oni-oa-part-eyes" data-oa-part="eyes"></span>
                  <span class="oni-oa-layer oni-oa-part-mouth" data-oa-part="mouth"></span>
                </button>
              </div>

              <div class="oni-oa-stage-meta">
                <div class="oni-oa-stage-chip-row">
                  <small>ONI AI CHAMBER</small>
                  <small data-oa-mood>Тайван</small>
                  <small data-oa-stage-state>Бэлэн байна.</small>
                </div>
                <b data-oa-live-state>MEET хүлээлттэй</b>
                <p data-oa-stage-text>Сайн уу. ONI AI энд байна.</p>
                <small class="oni-oa-asset-note" data-oa-asset-note>Production art slot бэлэн.</small>
              </div>
            </div>
          </section>

          <section class="oni-oa-chat-pane">
            <div class="oni-oa-chat-head">
              <div>
                <strong>ONI AI</strong>
                <small>ONI world-ийн chamber дотор, яг таны хажууд</small>
              </div>
              <div class="oni-oa-chat-head-actions">
                <button type="button" class="oni-btn oni-btn-ghost" data-oa-cancel>ЦУЦЛАХ</button>
                <button type="button" class="oni-btn oni-btn-ghost" data-oa-retry>ДАХИН</button>
              </div>
            </div>

            <div class="oni-oa-chat-body" data-oa-body aria-live="polite"></div>
            <p class="oni-oa-inline-error" data-oa-error role="alert"></p>

            <div class="oni-oa-prompts" role="list" aria-label="ONI AI хурдан асуултууд">
              <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="Өнөөдөр meet байгаа юу?">MEET</button>
              <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="2-р дуу тоглуул">MUSIC</button>
              <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="Энэ өгүүлбэрийг англи хэл рүү орчуул">ОРЧУУЛГА</button>
              <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="Надад Instagram caption бич">ТАЙЛБАР</button>
            </div>

            <form class="oni-oa-compose" data-oa-form data-oa-compose-anchor novalidate>
              <textarea data-oa-input maxlength="2000" placeholder="ONI AI-д асуу…" aria-label="ONI AI зурвас"></textarea>
              <div class="oni-oa-compose-actions">
                <button type="submit" class="oni-btn oni-btn-primary" data-oa-send>ИЛГЭЭХ</button>
              </div>
            </form>
          </section>
        </div>
      </article>
    </section>
  `;
}

export function createOniAiModule() {
  let host = null;
  let mounted = false;
  let sending = false;
  let abortController = null;
  let requestToken = 0;
  let visualToken = 0;
  let lastFailurePrompt = "";
  let inlineError = "";
  let meetState = "NONE";
  let mood = "neutral";
  let conversationState = "idle";
  let tapLockedUntil = 0;
  let pendingPrompt = "";
  let cancelRequested = false;
  let isTalking = false;
  let activeTrack = null;
  let usingAssetFallback = true;
  let lastContextMode = "general";
  const history = [];
  const disposers = [];
  const visualTimers = new Set();
  let blinkTimer = 0;
  let idleTimer = 0;
  let talkingTimer = 0;

  function nodes() {
    if (!(host instanceof HTMLElement)) return {};
    return {
      body: host.querySelector("[data-oa-body]"),
      form: host.querySelector("[data-oa-form]"),
      input: host.querySelector("[data-oa-input]"),
      sendButton: host.querySelector("[data-oa-send]"),
      retryButton: host.querySelector("[data-oa-retry]"),
      cancelButton: host.querySelector("[data-oa-cancel]"),
      error: host.querySelector("[data-oa-error]"),
      scene: host.querySelector("[data-oa-scene]"),
      world: host.querySelector("[data-oa-world]"),
      stage: host.querySelector("[data-oa-stage]"),
      stageText: host.querySelector("[data-oa-stage-text]"),
      stageState: host.querySelector("[data-oa-stage-state]"),
      mood: host.querySelector("[data-oa-mood]"),
      liveState: host.querySelector("[data-oa-live-state]"),
      character: host.querySelector("[data-oa-character]"),
      aura: host.querySelector("[data-oa-aura]")
    };
  }

  function clearScheduled(timerId) {
    if (timerId) clearTimeout(timerId);
    return 0;
  }

  function clearVisualTimers() {
    for (const timerId of visualTimers) clearTimeout(timerId);
    visualTimers.clear();
  }

  function stopAmbientLife() {
    blinkTimer = clearScheduled(blinkTimer);
    idleTimer = clearScheduled(idleTimer);
    talkingTimer = clearScheduled(talkingTimer);
  }

  function teardownListeners() {
    while (disposers.length) {
      const dispose = disposers.pop();
      try {
        dispose();
      } catch {
        // Ignore cleanup errors.
      }
    }
    clearVisualTimers();
    stopAmbientLife();
  }

  function scheduleVisual(delay, handler, token = visualToken) {
    const timerId = setTimeout(() => {
      visualTimers.delete(timerId);
      if (!mounted || token !== visualToken) return;
      handler();
    }, Math.max(0, delay));
    visualTimers.add(timerId);
    return timerId;
  }

  function pushHistory(role, text) {
    history.push({ role, text: String(text || "") });
    while (history.length > 80) history.shift();
  }

  function prefersMotionReduction() {
    return prefersReducedMotion();
  }

  function buildPayload(message) {
    return {
      message,
      history: history
        .slice(-HISTORY_LIMIT)
        .map(item => ({ role: item.role, text: String(item.text || "").slice(0, HISTORY_TEXT_LIMIT) })),
      mood,
      meetState
    };
  }

  function buildSourceCards(sources) {
    const wrap = document.createElement("div");
    wrap.className = "oni-oa-source-wrap";
    wrap.innerHTML = sourceCardsMarkup(sources);
    return wrap;
  }

  function lastMessageNode(role) {
    const body = nodes().body;
    if (!(body instanceof HTMLElement)) return null;
    return body.querySelector(`.oni-oa-msg.is-${role}[data-oa-latest="1"]`) || body.querySelector(`.oni-oa-msg.is-${role}:last-of-type`);
  }

  function setLatest(role, node) {
    const body = nodes().body;
    if (!(body instanceof HTMLElement) || !(node instanceof HTMLElement)) return;
    body.querySelectorAll(`.oni-oa-msg.is-${role}[data-oa-latest="1"]`).forEach(item => item.dataset.oaLatest = "0");
    node.dataset.oaLatest = "1";
  }

  function scrollChatToBottom() {
    const body = nodes().body;
    if (!(body instanceof HTMLElement)) return;
    body.scrollTop = body.scrollHeight;
  }

  function appendMessage(role, text, { typing = false, sources = [] } = {}) {
    const body = nodes().body;
    if (!(body instanceof HTMLElement)) return null;

    const wrap = document.createElement("article");
    wrap.className = `oni-oa-msg is-${role}${typing ? " is-typing" : ""} is-enter`;
    wrap.dataset.oaRole = role;
    if (typing) wrap.dataset.oaTyping = "1";

    const label = document.createElement("small");
    label.className = "oni-oa-msg-label";
    label.textContent = role === "user" ? "ТА" : "ONI AI";

    const content = document.createElement("p");
    content.className = "oni-oa-msg-text";
    content.textContent = String(text || "");

    wrap.append(label, content);
    if (!typing && role === "ai" && Array.isArray(sources) && sources.length) {
      wrap.appendChild(buildSourceCards(sources));
    }

    body.appendChild(wrap);
    setLatest(role, wrap);
    scrollChatToBottom();

    if (!typing) pushHistory(role, text);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => wrap.classList.add("is-ready"));
    else wrap.classList.add("is-ready");
    return wrap;
  }

  function setTyping(visible) {
    const body = nodes().body;
    if (!(body instanceof HTMLElement)) return;
    const existing = body.querySelector("[data-oa-typing]");
    if (visible) {
      if (existing) return;
      appendMessage("ai", "Бодож байна…", { typing: true });
      return;
    }
    existing?.remove();
  }

  function setState(nextState, labelText = "") {
    const n = nodes();
    const safeState = sanitizeConversationState(nextState);
    conversationState = safeState;
    if (n.stage instanceof HTMLElement) n.stage.dataset.oaState = safeState;
    if (n.stageState instanceof HTMLElement) n.stageState.textContent = labelText || stateLabel(safeState);
  }

  function setMotionVars(profile) {
    const stage = nodes().stage;
    if (!(stage instanceof HTMLElement)) return;
    Object.entries(profile).forEach(([key, value]) => stage.style.setProperty(key, String(value)));
  }

  function findSemanticTargetRect(target) {
    const n = nodes();
    if (!(n.scene instanceof HTMLElement)) return null;
    if (target === "latest-user-message") return lastMessageNode("user")?.getBoundingClientRect?.() || null;
    if (target === "latest-ai-message") return lastMessageNode("ai")?.getBoundingClientRect?.() || null;
    if (target === "composer") return n.form?.getBoundingClientRect?.() || null;
    if (target === "meet-area") return n.liveState?.getBoundingClientRect?.() || null;
    return null;
  }

  function semanticGazePosition(target) {
    const safeTarget = sanitizeGazeTarget(target);
    const n = nodes();
    const sceneRect = n.scene?.getBoundingClientRect?.();
    const targetRect = findSemanticTargetRect(safeTarget);

    if (sceneRect && targetRect && sceneRect.width > 0 && sceneRect.height > 0) {
      const centerX = targetRect.left + (targetRect.width / 2);
      const centerY = targetRect.top + (targetRect.height / 2);
      return {
        x: clamp((((centerX - sceneRect.left) / sceneRect.width) * 2) - 1, -1, 1),
        y: clamp((((centerY - sceneRect.top) / sceneRect.height) * 2) - 1, -1, 1)
      };
    }

    if (safeTarget === "latest-user-message") return { x: 0.5, y: 0.12 };
    if (safeTarget === "latest-ai-message") return { x: 0.66, y: 0.22 };
    if (safeTarget === "composer") return { x: 0.6, y: 0.78 };
    if (safeTarget === "meet-area") return { x: 0.32, y: -0.28 };
    if (safeTarget === "neutral-left") return { x: -0.42, y: -0.12 };
    if (safeTarget === "neutral-right") return { x: 0.36, y: -0.08 };
    return { x: 0.12, y: 0.04 };
  }

  function applyGaze(target, intensity = 0.45) {
    const stage = nodes().stage;
    if (!(stage instanceof HTMLElement)) return;
    const safeTarget = sanitizeGazeTarget(target);
    const safeIntensity = clampIntensity(intensity);
    const reduced = prefersMotionReduction();
    const point = semanticGazePosition(safeTarget);
    const eyeX = clamp(point.x * (reduced ? 3 : 10), -10, 10);
    const eyeY = clamp(point.y * (reduced ? 2 : 7), -7, 7);
    const headX = clamp(point.x * safeIntensity * 8, -8, 8);
    const headY = clamp(point.y * safeIntensity * 7, -7, 7);
    const torsoX = clamp(point.x * safeIntensity * 4, -4, 4);

    stage.dataset.oaGaze = safeTarget;
    stage.style.setProperty("--oa-eyes-x", `${eyeX.toFixed(2)}px`);
    stage.style.setProperty("--oa-eyes-y", `${eyeY.toFixed(2)}px`);

    if (reduced) {
      stage.style.setProperty("--oa-head-x", `${headX.toFixed(2)}px`);
      stage.style.setProperty("--oa-head-y", `${headY.toFixed(2)}px`);
      stage.style.setProperty("--oa-torso-x", `${torsoX.toFixed(2)}px`);
      return;
    }

    scheduleVisual(randomInt(80, 150), () => {
      stage.style.setProperty("--oa-head-x", `${headX.toFixed(2)}px`);
      stage.style.setProperty("--oa-head-y", `${headY.toFixed(2)}px`);
    });

    scheduleVisual(randomInt(180, 300), () => {
      stage.style.setProperty("--oa-torso-x", `${torsoX.toFixed(2)}px`);
    });
  }

  function setBlinking(on) {
    const stage = nodes().stage;
    if (!(stage instanceof HTMLElement)) return;
    stage.dataset.oaBlink = on ? "1" : "0";
  }

  function blinkOnce() {
    if (!mounted) return;
    setBlinking(true);
    scheduleVisual(110, () => setBlinking(false));
  }

  function scheduleBlinkLoop() {
    blinkTimer = clearScheduled(blinkTimer);
    if (!mounted) return;
    const state = conversationState;
    const delay = state === "thinking"
      ? randomInt(2800, 4700)
      : state === "responding"
        ? randomInt(3300, 5200)
        : randomInt(2400, 4600);
    blinkTimer = setTimeout(() => {
      blinkOnce();
      scheduleBlinkLoop();
    }, delay);
  }

  function ambientIdleTarget() {
    if (prefersMotionReduction()) return "user";
    const options = ["user", "neutral-left", "neutral-right", "latest-ai-message"];
    return options[randomInt(0, options.length - 1)];
  }

  function scheduleIdleLife() {
    idleTimer = clearScheduled(idleTimer);
    if (!mounted) return;
    idleTimer = setTimeout(() => {
      if (!mounted || sending || isTalking || conversationState === "thinking" || conversationState === "tool-working") {
        scheduleIdleLife();
        return;
      }
      applyGaze(ambientIdleTarget(), 0.22);
      scheduleIdleLife();
    }, randomInt(3200, 5600));
  }

  function ensureAssetMode() {
    const scene = nodes().scene;
    if (!(scene instanceof HTMLElement)) return;
    const slots = window.ONI_AI_CHARACTER_ASSETS;
    usingAssetFallback = true;
    if (slots && typeof slots === "object" && Object.keys(slots).length > 0) {
      const required = ["head", "torso", "legs"];
      usingAssetFallback = !required.every(key => /^(\.\/|\.\.\/|https?:\/\/|\/)/i.test(asText(slots[key])));
    }
    scene.dataset.oaAsset = usingAssetFallback ? "fallback" : "layered";
    const assetNote = scene.querySelector("[data-oa-asset-note]");
    if (assetNote) {
      assetNote.textContent = usingAssetFallback
        ? "Final original illustration asset хараахан холбогдоогүй · fallback rig идэвхтэй."
        : "Original layered illustration asset идэвхтэй.";
    }
  }

  function applyCharacterState({
    emotion = "neutral",
    gesture = "idle",
    posture = "",
    gaze = "user",
    intensity = 0.45,
    conversation = "idle",
    text = "",
    speaking = false
  } = {}) {
    const n = nodes();
    if (!(n.stage instanceof HTMLElement)) return;

    const safeEmotion = sanitizeEmotion(emotion);
    const safeGesture = sanitizeGesture(gesture);
    const safeState = sanitizeConversationState(conversation);
    const safeIntensity = clampIntensity(intensity);
    const safePosture = sanitizePosture(posture || fallbackPosture(safeEmotion, safeGesture, safeState));
    const profile = createMotionProfile({
      emotion: safeEmotion,
      gesture: safeGesture,
      posture: safePosture,
      intensity: safeIntensity,
      speaking
    });

    n.stage.dataset.oaEmotion = safeEmotion;
    n.stage.dataset.oaGesture = safeGesture;
    n.stage.dataset.oaPosture = safePosture;
    n.stage.dataset.oaSpeaking = speaking ? "1" : "0";
    n.stage.style.setProperty("--oa-intensity", String(safeIntensity.toFixed(2)));
    setMotionVars(profile);
    applyGaze(gaze, safeIntensity);
    setState(safeState);

    if (n.stageText instanceof HTMLElement) n.stageText.textContent = text || stateLabel(safeState);
    if (n.mood instanceof HTMLElement) n.mood.textContent = emotionLabel(safeEmotion);
    if (n.liveState instanceof HTMLElement) n.liveState.textContent = meetStateLabel(meetState);
    mood = safeEmotion;
  }

  function renderUiState() {
    const n = nodes();
    if (n.sendButton instanceof HTMLButtonElement) {
      n.sendButton.disabled = false;
      n.sendButton.textContent = sending ? "Илгээж байна…" : "ИЛГЭЭХ";
    }
    if (n.retryButton instanceof HTMLButtonElement) n.retryButton.disabled = !lastFailurePrompt;
    if (n.cancelButton instanceof HTMLButtonElement) n.cancelButton.disabled = !sending;
    if (n.error instanceof HTMLElement) n.error.textContent = inlineError;
    if (n.liveState instanceof HTMLElement) n.liveState.textContent = meetStateLabel(meetState);
  }

  function contextFromMessage(message = "", packet = null) {
    const text = `${message} ${packet?.text || ""}`.toLowerCase();
    if (packet?.emotion === "music" || /\b(дуу|music|playlist|track|song|play|pause|next|prev)\b/i.test(text)) return "music";
    if (packet?.emotion === "meet-live" || /\bmeet\b|уулз|ивент|live/i.test(text)) return "meet";
    return "general";
  }

  function selectThinkingVariant(message) {
    return THINKING_VARIANTS[hashText(message) % THINKING_VARIANTS.length];
  }

  function contextualIdle() {
    if (activeTrack && !activeTrack.paused) {
      applyCharacterState({
        emotion: "music",
        gesture: "dance-subtle",
        posture: "music",
        gaze: "user",
        intensity: 0.42,
        conversation: "music",
        text: `♪ ${activeTrack.current?.title || "Хөгжим тоглож байна"}`
      });
      return;
    }

    if (meetState === "LIVE" && lastContextMode === "meet") {
      applyCharacterState({
        emotion: "meet-live",
        gesture: "calm",
        posture: "attentive",
        gaze: "meet-area",
        intensity: 0.44,
        conversation: "meet-live",
        text: "MEET төлөвийг ажиглаж байна."
      });
      return;
    }

    applyCharacterState({
      emotion: mood === "neutral" ? "neutral" : sanitizeEmotion(mood),
      gesture: "idle",
      posture: fallbackPosture(mood, "idle", "idle"),
      gaze: "user",
      intensity: 0.24,
      conversation: "idle",
      text: "Бэлэн байна."
    });
  }

  function setTalking(active, duration = 0) {
    isTalking = !!active;
    talkingTimer = clearScheduled(talkingTimer);
    const stage = nodes().stage;
    if (stage instanceof HTMLElement) stage.dataset.oaSpeaking = active ? "1" : "0";
    if (active && duration > 0) {
      talkingTimer = setTimeout(() => {
        isTalking = false;
        if (stage instanceof HTMLElement) stage.dataset.oaSpeaking = "0";
      }, duration);
    }
  }

  async function callAiBackend(message) {
    if (abortController) abortController.abort();

    const controller = new AbortController();
    abortController = controller;
    const currentRequest = ++requestToken;
    let didTimeout = false;

    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(aiEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(message)),
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal
      });

      if (!mounted || currentRequest !== requestToken) return { stale: true };

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const detail = asText(data?.detail) || asText(data?.error) || `HTTP ${response.status}`;
        throw new Error(detail);
      }

      const packet = normalizeAiPacket(data);
      if (!packet.text) throw new Error("Хариуны бүтэц буруу байна.");
      return packet;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError" && didTimeout) {
        throw new Error("TIMEOUT_ABORT");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (abortController === controller) abortController = null;
    }
  }

  function handleMusicQuickCommand(message) {
    const command = parseMusicCommand(message);
    if (!command) return null;
    return runMusicCommand(command);
  }

  function executeUiAction(uiAction) {
    if (!uiAction || typeof uiAction !== "object") return null;
    if (uiAction.type !== "music") return null;

    const command = asText(uiAction.command);
    const index = Number(uiAction.index);
    if (command === "play_index" && Number.isFinite(index)) return runMusicCommand({ type: "playByName", query: String(index + 1) });
    if (command === "play") return runMusicCommand({ type: "play" });
    if (command === "pause") return runMusicCommand({ type: "pause" });
    if (command === "next") return runMusicCommand({ type: "next" });
    if (command === "prev") return runMusicCommand({ type: "prev" });
    return null;
  }

  function beginReactionSequence(message) {
    clearVisualTimers();
    visualToken += 1;
    const token = visualToken;
    const thinkingVariant = selectThinkingVariant(message);

    applyCharacterState({
      emotion: "neutral",
      gesture: "listen",
      posture: "attentive",
      gaze: "latest-user-message",
      intensity: 0.24,
      conversation: "noticed-message",
      text: "Анзаарлаа…"
    });

    scheduleVisual(120, () => {
      applyCharacterState({
        emotion: "neutral",
        gesture: "listen",
        posture: "attentive",
        gaze: "latest-user-message",
        intensity: 0.28,
        conversation: "reading",
        text: "Уншиж байна…"
      });
    }, token);

    scheduleVisual(340, () => {
      applyCharacterState({
        emotion: "neutral",
        gesture: "listen",
        posture: "attentive",
        gaze: "latest-user-message",
        intensity: 0.3,
        conversation: "listening",
        text: "Сонсож байна…"
      });
    }, token);

    scheduleVisual(680, () => {
      if (!sending) return;
      applyCharacterState({
        emotion: "thinking",
        gesture: thinkingVariant.gesture,
        posture: thinkingVariant.posture,
        gaze: thinkingVariant.gaze,
        intensity: thinkingVariant.intensity,
        conversation: "thinking",
        text: thinkingVariant.text
      });
    }, token);

    scheduleVisual(1450, () => {
      if (!sending) return;
      applyCharacterState({
        emotion: "thinking",
        gesture: "think",
        posture: "forward",
        gaze: "neutral-right",
        intensity: 0.38,
        conversation: "tool-working",
        text: "Хариуг гүн боловсруулж байна…"
      });
    }, token);
  }

  function finishSpeaking(packet) {
    clearVisualTimers();
    visualToken += 1;
    const token = visualToken;
    const speakDuration = prefersMotionReduction()
      ? 420
      : clamp(900 + (packet.text.length * 16), 1200, 4200);

    const previousUserMessage = history.length >= 2 ? history[history.length - 2]?.text || "" : "";
    lastContextMode = contextFromMessage(previousUserMessage, packet);
    setTalking(true, speakDuration);
    applyCharacterState({
      emotion: packet.emotion,
      gesture: packet.gesture === "idle" ? "talk" : packet.gesture,
      posture: fallbackPosture(packet.emotion, packet.gesture, "responding"),
      gaze: "latest-ai-message",
      intensity: packet.intensity,
      conversation: packet.emotion === "music" ? "music" : packet.emotion === "meet-live" ? "meet-live" : "responding",
      text: "Хариулж байна…",
      speaking: true
    });

    if (!prefersMotionReduction()) {
      scheduleVisual(Math.min(560, speakDuration / 2), () => applyGaze("user", Math.max(0.24, packet.intensity * 0.55)), token);
    }

    scheduleVisual(speakDuration, () => {
      setTalking(false);
      applyCharacterState({
        emotion: packet.emotion,
        gesture: "calm",
        posture: fallbackPosture(packet.emotion, "calm", "finished-speaking"),
        gaze: "user",
        intensity: Math.max(0.2, packet.intensity * 0.55),
        conversation: "finished-speaking",
        text: "Хариуллаа."
      });
    }, token);

    scheduleVisual(speakDuration + 1100, () => contextualIdle(), token);
  }

  function handleQueuedPrompt() {
    if (!pendingPrompt) return false;
    const queued = pendingPrompt;
    pendingPrompt = "";
    sendMessage(queued);
    return true;
  }

  function interruptForLatestPrompt(message) {
    pendingPrompt = message;
    cancelRequested = false;
    clearVisualTimers();
    visualToken += 1;
    setTyping(false);
    applyCharacterState({
      emotion: "neutral",
      gesture: "listen",
      posture: "attentive",
      gaze: "composer",
      intensity: 0.22,
      conversation: "noticed-message",
      text: "Шинэ зурвас руу шилжиж байна…"
    });
    if (abortController) abortController.abort();
  }

  async function sendMessage(rawInput) {
    const message = asText(rawInput);
    if (!message) {
      inlineError = "Хоосон мессеж илгээх боломжгүй.";
      renderUiState();
      return;
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      inlineError = `Мессеж ${MAX_MESSAGE_CHARS} тэмдэгтээс их байж болохгүй.`;
      renderUiState();
      return;
    }
    if (sending) return;

    inlineError = "";
    appendMessage("user", message);
    lastContextMode = contextFromMessage(message);

    const quick = handleMusicQuickCommand(message);
    if (quick?.handled) {
      appendMessage("ai", quick.message || "Боллоо.");
      lastFailurePrompt = "";
      activeTrack = { ...activeTrack, paused: false, current: activeTrack?.current || null };
      finishSpeaking({
        text: quick.message || "Боллоо.",
        emotion: "music",
        gesture: "dance-subtle",
        intensity: 0.56
      });
      renderUiState();
      return;
    }

    sending = true;
    cancelRequested = false;
    setTyping(true);
    beginReactionSequence(message);
    renderUiState();

    try {
      const packet = await callAiBackend(message);
      if (!mounted || packet?.stale) return;
      setTyping(false);
      appendMessage("ai", packet.text || "Хариу ирсэнгүй.", { sources: packet.sources });
      lastFailurePrompt = "";
      executeUiAction(packet.uiAction);
      finishSpeaking(packet);
    } catch (error) {
      if (!mounted) return;
      setTyping(false);

      if (error instanceof Error && error.name === "AbortError" && cancelRequested) {
        inlineError = "";
        lastFailurePrompt = message;
        setTalking(false);
        clearVisualTimers();
        applyCharacterState({
          emotion: "neutral",
          gesture: "calm",
          posture: "soft",
          gaze: "user",
          intensity: 0.2,
          conversation: "idle",
          text: "Хүсэлт цуцлагдлаа."
        });
        appendMessage("ai", "Хүсэлт цуцлагдлаа.");
        return;
      }

      if (error instanceof Error && error.name === "AbortError" && pendingPrompt) return;

      const reason = error instanceof Error && error.message === "TIMEOUT_ABORT"
        ? "30 секундийн дотор хариу ирсэнгүй."
        : "Мэдээлэлтэй холбогдож чадсангүй.";
      inlineError = reason;
      lastFailurePrompt = message;
      appendMessage("ai", `⚠️ ${reason}`);
      setTalking(false);
      clearVisualTimers();
      applyCharacterState({
        emotion: "concerned",
        gesture: "calm",
        posture: "soft",
        gaze: "composer",
        intensity: 0.3,
        conversation: "error",
        text: reason
      });
    } finally {
      if (!mounted) return;
      sending = false;
      cancelRequested = false;
      renderUiState();
      if (handleQueuedPrompt()) return;
      scheduleBlinkLoop();
      scheduleIdleLife();
    }
  }

  function bindDom() {
    const n = nodes();

    if (n.form instanceof HTMLFormElement) {
      const onSubmit = event => {
        event.preventDefault();
        const text = n.input instanceof HTMLTextAreaElement ? n.input.value : "";
        if (n.input instanceof HTMLTextAreaElement) n.input.value = "";
        if (sending) {
          if (!asText(text)) return;
          interruptForLatestPrompt(text);
          return;
        }
        sendMessage(text);
      };
      n.form.addEventListener("submit", onSubmit);
      disposers.push(() => n.form.removeEventListener("submit", onSubmit));
    }

    if (n.input instanceof HTMLTextAreaElement) {
      const onKeyDown = event => {
        if (event.key !== "Enter") return;
        if (event.shiftKey) return;
        event.preventDefault();
        const text = n.input.value;
        n.input.value = "";
        if (sending) {
          if (!asText(text)) return;
          interruptForLatestPrompt(text);
          return;
        }
        sendMessage(text);
      };
      n.input.addEventListener("keydown", onKeyDown);
      disposers.push(() => n.input.removeEventListener("keydown", onKeyDown));
    }

    if (n.retryButton instanceof HTMLButtonElement) {
      const onRetry = () => {
        if (!lastFailurePrompt) return;
        if (sending) {
          interruptForLatestPrompt(lastFailurePrompt);
          return;
        }
        sendMessage(lastFailurePrompt);
      };
      n.retryButton.addEventListener("click", onRetry);
      disposers.push(() => n.retryButton.removeEventListener("click", onRetry));
    }

    if (n.cancelButton instanceof HTMLButtonElement) {
      const onCancel = () => {
        if (!sending || !abortController) return;
        pendingPrompt = "";
        cancelRequested = true;
        clearVisualTimers();
        setTyping(false);
        abortController.abort();
      };
      n.cancelButton.addEventListener("click", onCancel);
      disposers.push(() => n.cancelButton.removeEventListener("click", onCancel));
    }

    host?.querySelectorAll("[data-oa-prompt]").forEach(button => {
      if (!(button instanceof HTMLButtonElement)) return;
      const onClick = () => {
        const prompt = asText(button.dataset.oaPrompt);
        if (!prompt) return;
        if (sending) {
          interruptForLatestPrompt(prompt);
          return;
        }
        sendMessage(prompt);
      };
      button.addEventListener("click", onClick);
      disposers.push(() => button.removeEventListener("click", onClick));
    });

    if (n.character instanceof HTMLButtonElement) {
      const onTap = () => {
        const now = Date.now();
        if (now < tapLockedUntil) return;
        tapLockedUntil = now + 900;
        const reaction = TAP_REACTIONS[randomInt(0, TAP_REACTIONS.length - 1)];
        blinkOnce();
        clearVisualTimers();
        visualToken += 1;
        applyCharacterState({
          emotion: reaction.emotion,
          gesture: reaction.gesture,
          posture: reaction.posture,
          gaze: reaction.gaze,
          intensity: 0.38,
          conversation: sending ? conversationState : "finished-speaking",
          text: reaction.text
        });
        scheduleVisual(900, () => {
          if (!sending) contextualIdle();
        });
      };
      n.character.addEventListener("click", onTap);
      disposers.push(() => n.character.removeEventListener("click", onTap));
    }

    const onMusic = subscribeMusicState(snapshot => {
      if (!mounted) return;
      activeTrack = snapshot;
      if (!snapshot.paused && snapshot.current && !sending) {
        applyCharacterState({
          emotion: "music",
          gesture: "dance-subtle",
          posture: "music",
          gaze: "user",
          intensity: 0.44,
          conversation: "music",
          text: `♪ ${snapshot.current.title}`
        });
      } else if (!sending && conversationState === "music") {
        contextualIdle();
      }
      renderUiState();
    });
    disposers.push(onMusic);

    const onMeet = subscribeMeetWorldState(snapshot => {
      if (!mounted) return;
      meetState = snapshot.state;
      if (!sending && meetState !== "LIVE" && conversationState === "meet-live") {
        contextualIdle();
      }
      renderUiState();
    });
    disposers.push(onMeet);
  }

  return {
    key: "oni-ai",
    title: "ONI AI",
    description: "Secure ONI Brain chat with Mongolian-first UX, citations, and living character states.",
    status: "live",

    mount(root) {
      if (!(root instanceof HTMLElement)) return;
      if (mounted && host === root) return;

      this.unmount();

      host = root;
      mounted = true;
      sending = false;
      abortController = null;
      requestToken += 1;
      visualToken += 1;
      lastFailurePrompt = "";
      inlineError = "";
      meetState = "NONE";
      mood = "neutral";
      conversationState = "idle";
      tapLockedUntil = 0;
      pendingPrompt = "";
      cancelRequested = false;
      isTalking = false;
      activeTrack = null;
      lastContextMode = "general";

      host.innerHTML = routeMarkup();
      ensureAssetMode();
      bindDom();
      startMusicIntegration();
      appendMessage("ai", "Сайн уу. Би ONI AI — чөлөөтэй асуугаарай.");
      contextualIdle();
      renderUiState();
      scheduleBlinkLoop();
      scheduleIdleLife();
    },

    unmount() {
      mounted = false;
      sending = false;
      requestToken += 1;
      visualToken += 1;
      pendingPrompt = "";
      cancelRequested = false;
      setTalking(false);
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      setTyping(false);
      teardownListeners();
      stopMusicIntegration();
      host = null;
    }
  };
}
