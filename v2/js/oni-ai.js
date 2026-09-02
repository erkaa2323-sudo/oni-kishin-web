import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFirestoreDb } from "./firebase.js";
import {
  getMusicSnapshot,
  nextTrack,
  parseMusicCommand,
  pauseMusic,
  playMusic,
  playTrackAt,
  runMusicCommand,
  setMusicVolume,
  startMusicIntegration,
  stopMusicIntegration,
  subscribeMusicState
} from "./music.js";

const DEFAULT_AI_ENDPOINT = "https://oni-kishin-web.erkaa2323.workers.dev/api/oni-ai";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_MESSAGE_CHARS = 2000;
const HISTORY_LIMIT = 18;
const HISTORY_TEXT_LIMIT = 1200;

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toErrorText(error) {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(value / 60);
  const remain = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

function aiEndpoint() {
  return asText(window.ONI_AI_CONFIG?.endpoint) || DEFAULT_AI_ENDPOINT;
}

function routeMarkup() {
  return `
    <section class="oni-oa-view" data-oa-view>
      <header class="oni-section-head">
        <h1>ONI AI</h1>
        <p>Монгол хэл дээр ONI туслахтай ярилцаж, Music-г нэг player-ээр удирдана.</p>
      </header>

      <article class="oni-card oni-oa-status-row">
        <div>
          <small>BACKEND</small>
          <b data-oa-backend-state>Connecting…</b>
        </div>
        <div>
          <small>LIVE DATA</small>
          <b data-oa-knowledge-state>Syncing…</b>
        </div>
      </article>

      <article class="oni-card oni-oa-chat-card">
        <div class="oni-oa-chat-head">
          <strong>ONI AI</strong>
          <div class="oni-oa-chat-head-actions">
            <button type="button" class="oni-btn oni-btn-ghost" data-oa-cancel>Cancel</button>
            <button type="button" class="oni-btn oni-btn-ghost" data-oa-retry>Retry</button>
          </div>
        </div>
        <div class="oni-oa-chat-body" data-oa-body aria-live="polite"></div>
        <p class="oni-oa-inline-error" data-oa-error role="alert"></p>
        <form class="oni-oa-compose" data-oa-form novalidate>
          <textarea data-oa-input maxlength="2000" placeholder="ONI AI-д асуу…" aria-label="ONI AI message"></textarea>
          <div class="oni-oa-compose-actions">
            <button type="submit" class="oni-btn oni-btn-primary" data-oa-send>Send</button>
          </div>
        </form>
      </article>

      <article class="oni-card oni-oa-music-card">
        <div class="oni-oa-music-head">
          <strong>ONI Music</strong>
          <small data-oa-music-count>0 songs</small>
        </div>
        <div class="oni-oa-music-current">
          <b data-oa-music-title>NO MUSIC</b>
          <small data-oa-music-artist>ADMIN-аас дуу нийтлэнэ</small>
        </div>
        <div class="oni-oa-music-progress">
          <i data-oa-music-progress></i>
        </div>
        <div class="oni-oa-music-meta">
          <small data-oa-music-time>00:00 / 00:00</small>
          <label>VOL <input data-oa-music-volume type="range" min="0" max="1" step="0.01" value="0.72"></label>
        </div>
        <div class="oni-oa-music-actions">
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-music-prev>⏮</button>
          <button type="button" class="oni-btn oni-btn-primary" data-oa-music-play>▶</button>
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-music-next>⏭</button>
        </div>
        <div class="oni-oa-music-quick">
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="what songs are available?">Songs</button>
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="play music">Play</button>
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="pause music">Pause</button>
          <button type="button" class="oni-btn oni-btn-ghost" data-oa-prompt="next song">Next</button>
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
  let lastUserPrompt = "";
  let lastFailurePrompt = "";
  let inlineError = "";
  let backendState = "Idle";
  let knowledgeState = "Syncing…";
  let knowledge = {
    source: "V2 condensed snapshot; backend tools are authoritative.",
    counts: { members: 0, garage: 0, participants: 0, tracks: 0 },
    meet: null,
    music: []
  };
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
      backendState: host.querySelector("[data-oa-backend-state]"),
      knowledgeState: host.querySelector("[data-oa-knowledge-state]"),
      musicCount: host.querySelector("[data-oa-music-count]"),
      musicTitle: host.querySelector("[data-oa-music-title]"),
      musicArtist: host.querySelector("[data-oa-music-artist]"),
      musicProgress: host.querySelector("[data-oa-music-progress]"),
      musicTime: host.querySelector("[data-oa-music-time]"),
      musicVolume: host.querySelector("[data-oa-music-volume]"),
      musicPlay: host.querySelector("[data-oa-music-play]"),
      musicPrev: host.querySelector("[data-oa-music-prev]"),
      musicNext: host.querySelector("[data-oa-music-next]")
    };
  }

  function pushHistory(role, text) {
    history.push({ role, text: String(text || "") });
    while (history.length > 80) history.shift();
  }

  function appendMessage(role, text, { typing = false } = {}) {
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
      content.textContent = "Ухаалгаар боловсруулж байна…";

      wrap.append(label, content);
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
      return;
    }

    existing?.remove();
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

    if (n.backendState instanceof HTMLElement) {
      n.backendState.textContent = backendState;
    }

    if (n.knowledgeState instanceof HTMLElement) {
      n.knowledgeState.textContent = knowledgeState;
    }
  }

  async function loadKnowledgeSnapshot() {
    knowledgeState = "Syncing…";
    renderUiState();

    try {
      const db = getFirestoreDb();
      const [members, garage, participants, meetSnap] = await Promise.all([
        getDocs(collection(db, "members")),
        getDocs(collection(db, "garage")),
        getDocs(collection(db, "meetParticipants")),
        getDoc(doc(db, "meets", "current"))
      ]);

      if (!mounted) return;

      knowledge = {
        source: "V2 condensed snapshot; backend tools are authoritative.",
        counts: {
          members: members.size,
          garage: garage.size,
          participants: participants.size,
          tracks: getMusicSnapshot().tracks.length
        },
        meet: meetSnap.exists() ? {
          id: meetSnap.id,
          name: asText(meetSnap.data()?.name),
          enabled: meetSnap.data()?.enabled !== false,
          startAt: meetSnap.data()?.startAt || null,
          maxPlayers: Number(meetSnap.data()?.maxPlayers || 0) || null
        } : null,
        music: getMusicSnapshot().tracks.slice(0, 24).map(track => ({
          title: track.title,
          artist: track.artist
        }))
      };

      knowledgeState = `Ready · ${knowledge.counts.members} members · ${knowledge.counts.tracks} songs`;
    } catch (error) {
      knowledgeState = `Sync error: ${toErrorText(error)}`;
    }

    renderUiState();
  }

  function buildPayload(message) {
    return {
      message,
      history: history
        .slice(-HISTORY_LIMIT)
        .map(item => ({ role: item.role, text: String(item.text || "").slice(0, HISTORY_TEXT_LIMIT) })),
      knowledge
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

      const reply = asText(data?.reply || data?.text);
      if (!reply) throw new Error("Malformed AI response.");
      return { reply };
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
    lastUserPrompt = message;
    appendMessage("user", message);

    const quick = handleMusicQuickCommand(message);
    if (quick?.handled) {
      appendMessage("ai", quick.message || "OK");
      lastFailurePrompt = "";
      backendState = "Local music command";
      renderUiState();
      return;
    }

    sending = true;
    backendState = "Requesting secure backend…";
    setTyping(true);
    renderUiState();

    try {
      const result = await callAiBackend(message);
      if (!mounted || result?.stale) return;
      setTyping(false);
      appendMessage("ai", result.reply || "Хариу ирсэнгүй.");
      backendState = "Live";
      lastFailurePrompt = "";
      await loadKnowledgeSnapshot();
    } catch (error) {
      if (!mounted) return;
      setTyping(false);
      const reason = error instanceof Error && error.name === "AbortError"
        ? "30 секундийн дотор хариу ирсэнгүй."
        : toErrorText(error);
      inlineError = reason;
      backendState = "Request failed";
      lastFailurePrompt = message;
      appendMessage("ai", `⚠️ ${reason}`);
    } finally {
      if (!mounted) return;
      sending = false;
      renderUiState();
    }
  }

  function bindMusicUi() {
    const n = nodes();

    if (n.musicPrev instanceof HTMLButtonElement) {
      const onPrev = () => {
        const result = playTrackAt(getMusicSnapshot().index - 1);
        if (result.message) appendMessage("ai", result.message);
      };
      n.musicPrev.addEventListener("click", onPrev);
      disposers.push(() => n.musicPrev.removeEventListener("click", onPrev));
    }

    if (n.musicPlay instanceof HTMLButtonElement) {
      const onPlay = () => {
        const snap = getMusicSnapshot();
        const result = snap.paused ? playMusic() : pauseMusic();
        if (result.message) appendMessage("ai", result.message);
      };
      n.musicPlay.addEventListener("click", onPlay);
      disposers.push(() => n.musicPlay.removeEventListener("click", onPlay));
    }

    if (n.musicNext instanceof HTMLButtonElement) {
      const onNext = () => {
        const result = nextTrack();
        if (result.message) appendMessage("ai", result.message);
      };
      n.musicNext.addEventListener("click", onNext);
      disposers.push(() => n.musicNext.removeEventListener("click", onNext));
    }

    if (n.musicVolume instanceof HTMLInputElement) {
      const onVolume = () => setMusicVolume(n.musicVolume.value);
      n.musicVolume.addEventListener("input", onVolume, { passive: true });
      disposers.push(() => n.musicVolume.removeEventListener("input", onVolume));
    }

    const onMusic = subscribeMusicState(snapshot => {
      if (!mounted) return;
      const view = nodes();
      if (view.musicCount) view.musicCount.textContent = `${snapshot.tracks.length} songs`;
      if (view.musicTitle) view.musicTitle.textContent = snapshot.current?.title || "NO MUSIC";
      if (view.musicArtist) view.musicArtist.textContent = snapshot.current?.artist || "ADMIN-аас дуу нийтлэнэ";
      if (view.musicTime) {
        view.musicTime.textContent = `${formatTime(snapshot.currentTime)} / ${formatTime(snapshot.duration)}`;
      }
      if (view.musicProgress) {
        const ratio = snapshot.duration > 0 ? Math.min(100, (snapshot.currentTime / snapshot.duration) * 100) : 0;
        view.musicProgress.style.width = `${ratio}%`;
      }
      if (view.musicPlay instanceof HTMLButtonElement) {
        view.musicPlay.textContent = snapshot.paused ? "▶" : "Ⅱ";
      }
      if (snapshot.error) {
        inlineError = snapshot.error;
        renderUiState();
      }
    });
    disposers.push(onMusic);
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

    bindMusicUi();
  }

  return {
    key: "oni-ai",
    title: "ONI AI",
    description: "Secure ONI AI chat with Mongolian-first UX and integrated clan music controls.",
    status: "live",

    mount(root) {
      if (!(root instanceof HTMLElement)) return;
      if (mounted && host === root) return;

      this.unmount();

      host = root;
      mounted = true;
      sending = false;
      requestToken += 1;
      lastUserPrompt = "";
      lastFailurePrompt = "";
      inlineError = "";
      backendState = "Idle";
      knowledgeState = "Syncing…";

      host.innerHTML = routeMarkup();
      bindDom();
      startMusicIntegration();
      appendMessage("ai", "Сайн уу. Би ONI AI. Монгол хэлээр асуугаарай — clan data болон music control-д тусална.");
      loadKnowledgeSnapshot();
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
