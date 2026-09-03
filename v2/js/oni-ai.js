import { parseMusicCommand, runMusicCommand, startMusicIntegration, stopMusicIntegration, subscribeMusicState } from "./music.js";
import { subscribeMeetWorldState } from "./meet-world.js";

const DEFAULT_AI_ENDPOINT = "https://oni-kishin-web.erkaa2323.workers.dev/api/oni-ai";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_MESSAGE_CHARS = 2000;
const HISTORY_LIMIT = 18;
const HISTORY_TEXT_LIMIT = 1200;
const EMOTIONS = new Set(["neutral", "happy", "excited", "thinking", "confused", "serious", "concerned", "sad", "sorry", "proud", "playful", "surprised", "music", "meet-live"]);
const GESTURES = new Set(["idle", "listen", "talk", "wave", "nod", "shake-head", "think", "point", "cheer", "laugh", "bow", "hands-on-hip", "surprised", "calm", "dance-subtle", "battle-ready"]);

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toErrorText(error) {
  if (error instanceof Error) return error.message;
  return String(error || "Алдаа гарлаа");
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

function clampIntensity(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.45;
  return Math.max(0, Math.min(1, num));
}

function sanitizeEmotion(value) {
  const key = asText(value).toLowerCase();
  return EMOTIONS.has(key) ? key : "neutral";
}

function sanitizeGesture(value) {
  const key = asText(value).toLowerCase();
  return GESTURES.has(key) ? key : "talk";
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

function routeMarkup() {
  return `
    <section class="oni-oa-view" data-oa-view>
      <article class="oni-card oni-oa-stage" data-oa-stage>
        <div class="oni-oa-world" aria-hidden="true">
          <span class="oni-oa-aura" data-oa-aura></span>
          <button type="button" class="oni-oa-character" data-oa-character aria-label="ONI character">
            <span class="oni-oa-layer oni-oa-body"></span>
            <span class="oni-oa-layer oni-oa-head"></span>
            <span class="oni-oa-layer oni-oa-eyes"></span>
            <span class="oni-oa-layer oni-oa-hands"></span>
            <span class="oni-oa-layer oni-oa-horns"></span>
          </button>
        </div>
        <div class="oni-oa-stage-meta">
          <small data-oa-mood>NEUTRAL</small>
          <b data-oa-live-state>MEET: NONE</b>
          <p data-oa-stage-text>ONI AI listening…</p>
        </div>
      </article>

      <article class="oni-card oni-oa-chat-card">
        <div class="oni-oa-chat-head">
          <strong>ONI AI</strong>
          <div class="oni-oa-chat-head-actions">
            <button type="button" class="oni-btn oni-btn-ghost" data-oa-cancel>Cancel</button>
            <button type="button" class="oni-btn oni-btn-ghost" data-oa-retry>ДАХИН</button>
          </div>
        </div>
        <div class="oni-oa-chat-body" data-oa-body aria-live="polite"></div>
        <p class="oni-oa-inline-error" data-oa-error role="alert"></p>
        <div class="oni-oa-prompts" role="list" aria-label="ONI quick prompts">
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="Өнөөдөр meet байгаа юу?">MEET</button>
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="2-р дуу тоглуул">MUSIC</button>
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="Энэ өгүүлбэрийг англи хэл рүү орчуул">TRANSLATE</button>
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="Надад Instagram caption бич">CAPTION</button>
        </div>
        <form class="oni-oa-compose" data-oa-form novalidate>
          <textarea data-oa-input maxlength="2000" placeholder="ONI AI-д асуу…" aria-label="ONI AI message"></textarea>
          <div class="oni-oa-compose-actions">
            <button type="submit" class="oni-btn oni-btn-primary" data-oa-send>Send</button>
          </div>
        </form>
      </article>
    </section>
  `;
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

function sourceCardsMarkup(sources) {
  if (!sources.length) return "";
  return `
    <div class="oni-oa-sources">
      ${sources.map(source => `
        <a class="oni-oa-source" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
          <small>SOURCE</small>
          <b>${escapeHtml(source.title)}</b>
        </a>
      `).join("")}
    </div>
  `;
}

export function createOniAiModule() {
  let host = null;
  let mounted = false;
  let sending = false;
  let abortController = null;
  let requestToken = 0;
  let lastFailurePrompt = "";
  let inlineError = "";
  let meetState = "NONE";
  let mood = "neutral";
  let thinkingTimer = 0;
  let tapLockedUntil = 0;
  const history = [];
  const disposers = [];

  function teardownListeners() {
    while (disposers.length) {
      const dispose = disposers.pop();
      try {
        dispose();
      } catch {
        // Ignore cleanup errors.
      }
    }
    if (thinkingTimer) {
      clearTimeout(thinkingTimer);
      thinkingTimer = 0;
    }
  }

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
      stage: host.querySelector("[data-oa-stage]"),
      stageText: host.querySelector("[data-oa-stage-text]"),
      mood: host.querySelector("[data-oa-mood]"),
      liveState: host.querySelector("[data-oa-live-state]"),
      character: host.querySelector("[data-oa-character]"),
      aura: host.querySelector("[data-oa-aura]")
    };
  }

  function pushHistory(role, text) {
    history.push({ role, text: String(text || "") });
    while (history.length > 80) history.shift();
  }

  function appendMessage(role, text, { typing = false, sources = [] } = {}) {
    const body = nodes().body;
    if (!(body instanceof HTMLElement)) return;

    const wrap = document.createElement("article");
    wrap.className = `oni-oa-msg ${role === "user" ? "is-user" : "is-ai"}${typing ? " is-typing" : ""}`;

    const label = document.createElement("small");
    label.className = "oni-oa-msg-label";
    label.textContent = role === "user" ? "YOU" : "ONI AI";

    const content = document.createElement("p");
    content.className = "oni-oa-msg-text";
    content.textContent = String(text || "");

    wrap.append(label, content);

    if (!typing && role === "ai" && Array.isArray(sources) && sources.length) {
      const sourceWrap = document.createElement("div");
      sourceWrap.className = "oni-oa-source-wrap";
      sourceWrap.innerHTML = sourceCardsMarkup(sources);
      wrap.appendChild(sourceWrap);
    }

    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;

    if (!typing) pushHistory(role, text);
  }

  function setTyping(visible) {
    const body = nodes().body;
    if (!(body instanceof HTMLElement)) return;
    const existing = body.querySelector("[data-oa-typing]");
    if (visible) {
      if (existing) return;
      const wrap = document.createElement("article");
      wrap.className = "oni-oa-msg is-ai is-typing";
      wrap.dataset.oaTyping = "1";

      const label = document.createElement("small");
      label.className = "oni-oa-msg-label";
      label.textContent = "ONI AI";

      const content = document.createElement("p");
      content.className = "oni-oa-msg-text";
      content.textContent = "Бодож байна…";

      wrap.append(label, content);
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
      return;
    }

    existing?.remove();
  }

  function applyCharacterState({ emotion = "neutral", gesture = "idle", intensity = 0.45, text = "" } = {}) {
    const n = nodes();
    if (!(n.stage instanceof HTMLElement)) return;
    const safeEmotion = sanitizeEmotion(emotion);
    const safeGesture = sanitizeGesture(gesture);
    const safeIntensity = clampIntensity(intensity);

    n.stage.dataset.oaEmotion = safeEmotion;
    n.stage.dataset.oaGesture = safeGesture;
    n.stage.style.setProperty("--oa-intensity", String(safeIntensity.toFixed(2)));
    if (n.aura instanceof HTMLElement) {
      n.aura.style.setProperty("--oa-aura", String(Math.max(0.08, safeIntensity).toFixed(2)));
    }
    if (n.stageText instanceof HTMLElement && text) n.stageText.textContent = text;
    if (n.mood instanceof HTMLElement) n.mood.textContent = safeEmotion.toUpperCase();
    mood = safeEmotion;
  }

  function renderUiState() {
    const n = nodes();

    if (n.sendButton instanceof HTMLButtonElement) {
      n.sendButton.disabled = sending;
      n.sendButton.textContent = sending ? "Sending…" : "Send";
    }

    if (n.retryButton instanceof HTMLButtonElement) {
      n.retryButton.disabled = sending || !lastFailurePrompt;
    }

    if (n.cancelButton instanceof HTMLButtonElement) {
      n.cancelButton.disabled = !sending;
    }

    if (n.error instanceof HTMLElement) {
      n.error.textContent = inlineError;
    }

    if (n.liveState instanceof HTMLElement) {
      n.liveState.textContent = `MEET: ${meetState}`;
    }
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

  async function callAiBackend(message) {
    if (abortController) abortController.abort();

    const controller = new AbortController();
    abortController = controller;
    const currentRequest = ++requestToken;

    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
      if (!packet.text) throw new Error("Malformed AI response.");
      return packet;
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
    if (command === "play_index" && Number.isFinite(index)) {
      return runMusicCommand({ type: "playByName", query: String(index + 1) });
    }
    if (command === "play") return runMusicCommand({ type: "play" });
    if (command === "pause") return runMusicCommand({ type: "pause" });
    if (command === "next") return runMusicCommand({ type: "next" });
    if (command === "prev") return runMusicCommand({ type: "prev" });
    return null;
  }

  function startThinkingReaction() {
    applyCharacterState({ emotion: "neutral", gesture: "listen", intensity: 0.32, text: "Сонсож байна…" });
    if (thinkingTimer) clearTimeout(thinkingTimer);
    thinkingTimer = setTimeout(() => {
      if (!mounted || !sending) return;
      applyCharacterState({ emotion: "thinking", gesture: "think", intensity: 0.5, text: "Боловсруулж байна…" });
    }, 220);
  }

  function finalizeAnswerReaction(packet) {
    applyCharacterState({
      emotion: packet.emotion,
      gesture: packet.gesture === "idle" ? "talk" : packet.gesture,
      intensity: packet.intensity,
      text: "Хариулж байна…"
    });

    setTimeout(() => {
      if (!mounted || sending) return;
      applyCharacterState({ emotion: mood, gesture: "idle", intensity: 0.28, text: "ONI AI ready." });
    }, 1400);
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

    const quick = handleMusicQuickCommand(message);
    if (quick?.handled) {
      appendMessage("ai", quick.message || "OK");
      lastFailurePrompt = "";
      applyCharacterState({ emotion: "music", gesture: "dance-subtle", intensity: 0.6, text: "Music control done." });
      renderUiState();
      return;
    }

    sending = true;
    setTyping(true);
    startThinkingReaction();
    renderUiState();

    try {
      const packet = await callAiBackend(message);
      if (!mounted || packet?.stale) return;
      setTyping(false);
      appendMessage("ai", packet.text || "Хариу ирсэнгүй.", { sources: packet.sources });
      lastFailurePrompt = "";
      executeUiAction(packet.uiAction);
      finalizeAnswerReaction(packet);
    } catch (error) {
      if (!mounted) return;
      setTyping(false);
      const reason = error instanceof Error && error.name === "AbortError"
        ? "30 секундийн дотор хариу ирсэнгүй."
        : "Мэдээлэлтэй холбогдож чадсангүй.";
      inlineError = reason;
      lastFailurePrompt = message;
      appendMessage("ai", `⚠️ ${reason}`);
      applyCharacterState({ emotion: "concerned", gesture: "calm", intensity: 0.35, text: "Сүлжээний алдаа гарлаа." });
    } finally {
      if (!mounted) return;
      sending = false;
      renderUiState();
    }
  }

  function bindDom() {
    const n = nodes();

    if (n.form instanceof HTMLFormElement) {
      const onSubmit = event => {
        event.preventDefault();
        const text = n.input instanceof HTMLTextAreaElement ? n.input.value : "";
        if (n.input instanceof HTMLTextAreaElement) n.input.value = "";
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
        sendMessage(text);
      };
      n.input.addEventListener("keydown", onKeyDown);
      disposers.push(() => n.input.removeEventListener("keydown", onKeyDown));
    }

    if (n.retryButton instanceof HTMLButtonElement) {
      const onRetry = () => {
        if (!lastFailurePrompt || sending) return;
        sendMessage(lastFailurePrompt);
      };
      n.retryButton.addEventListener("click", onRetry);
      disposers.push(() => n.retryButton.removeEventListener("click", onRetry));
    }

    if (n.cancelButton instanceof HTMLButtonElement) {
      const onCancel = () => {
        if (!sending || !abortController) return;
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
        const reactions = [
          { emotion: "happy", gesture: "wave", text: "👋" },
          { emotion: "playful", gesture: "nod", text: "🙂" },
          { emotion: "surprised", gesture: "surprised", text: "!" }
        ];
        const pick = reactions[Math.floor(Math.random() * reactions.length)];
        applyCharacterState({ ...pick, intensity: 0.42 });
      };
      n.character.addEventListener("click", onTap);
      disposers.push(() => n.character.removeEventListener("click", onTap));
    }

    const onMusic = subscribeMusicState(snapshot => {
      if (!mounted) return;
      if (!snapshot.paused && snapshot.current) {
        applyCharacterState({ emotion: "music", gesture: "dance-subtle", intensity: 0.52, text: `♪ ${snapshot.current.title}` });
      }
    });
    disposers.push(onMusic);

    const onMeet = subscribeMeetWorldState(snapshot => {
      if (!mounted) return;
      meetState = snapshot.state;
      if (snapshot.state === "LIVE") {
        applyCharacterState({ emotion: "meet-live", gesture: "battle-ready", intensity: 0.68, text: "ONI MEET LIVE" });
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
      requestToken += 1;
      lastFailurePrompt = "";
      inlineError = "";
      meetState = "NONE";
      mood = "neutral";

      host.innerHTML = routeMarkup();
      bindDom();
      startMusicIntegration();
      appendMessage("ai", "Сайн уу. Би ONI AI — чөлөөтэй асуугаарай.");
      applyCharacterState({ emotion: "neutral", gesture: "idle", intensity: 0.25, text: "ONI AI ready." });
      renderUiState();
    },

    unmount() {
      mounted = false;
      sending = false;
      requestToken += 1;
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
