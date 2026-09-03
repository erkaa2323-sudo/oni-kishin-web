import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFirestoreDb } from "./firebase.js";

const MUSIC_COLLECTION = "music";
const DEFAULT_VOLUME = 0.72;

const state = {
  audio: null,
  audioBound: false,
  tracks: [],
  index: 0,
  loading: false,
  error: "",
  listeners: new Set(),
  unsubscribeTracks: null,
  refCount: 0
};

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
}

function normalizeTrack(raw = {}, docId = "") {
  const url = pickFirstText(raw.file, raw.url, raw.audioUrl, raw.src);
  const status = pickFirstText(raw.status, "published").toLowerCase();
  const order = Number(raw.order);

  return {
    id: asText(docId) || `track-${Math.random().toString(36).slice(2, 10)}`,
    title: pickFirstText(raw.title, raw.name, "Нэргүй дуу"),
    artist: pickFirstText(raw.artist, "ONI RADIO"),
    url,
    cover: pickFirstText(raw.cover),
    order: Number.isFinite(order) ? order : 999999,
    hidden: status === "hidden"
  };
}

function playableTracks(list) {
  return list
    .map(item => normalizeTrack(item.data, item.id))
    .filter(track => !!track.url && !track.hidden)
    .sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title));
}

function ensureAudio() {
  if (state.audio) return state.audio;
  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = DEFAULT_VOLUME;
  state.audio = audio;
  bindAudioEvents();
  return audio;
}

function bindAudioEvents() {
  if (state.audioBound || !state.audio) return;
  state.audioBound = true;

  const audio = state.audio;
  const emit = () => notify();

  audio.addEventListener("play", emit);
  audio.addEventListener("pause", emit);
  audio.addEventListener("timeupdate", emit);
  audio.addEventListener("loadedmetadata", emit);
  audio.addEventListener("ended", () => {
    if (!state.tracks.length) return;
    state.index = (state.index + 1) % state.tracks.length;
    loadCurrentTrack(true);
  });
  audio.addEventListener("error", () => {
    state.error = "Энэ дууг тоглуулах боломжгүй байна.";
    notify();
  });
}

function loadCurrentTrack(autoplay = false) {
  const audio = ensureAudio();
  const current = getCurrentTrack();
  if (!current) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    notify();
    return;
  }

  if (audio.src !== current.url) {
    audio.src = current.url;
    audio.load();
  }

  if (autoplay) {
    audio.play().catch(() => {
      state.error = "Тоглуулахын тулд дахин дарна уу.";
      notify();
    });
  } else {
    notify();
  }
}

function getCurrentTrack() {
  if (!state.tracks.length) return null;
  const safeIndex = ((state.index % state.tracks.length) + state.tracks.length) % state.tracks.length;
  state.index = safeIndex;
  return state.tracks[safeIndex] || null;
}

function durationOrZero(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function notify() {
  const snapshot = getMusicSnapshot();
  for (const listener of state.listeners) {
    try {
      listener(snapshot);
    } catch {
      // Ignore listener failures.
    }
  }
}

function subscribeTracks() {
  if (typeof state.unsubscribeTracks === "function") return;

  state.loading = true;
  state.error = "";
  notify();

  const db = getFirestoreDb();
  state.unsubscribeTracks = onSnapshot(collection(db, MUSIC_COLLECTION), snapshot => {
    state.loading = false;
    state.error = "";

    state.tracks = playableTracks(snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      data: docSnap.data() || {}
    })));

    if (!state.tracks.length) {
      state.index = 0;
      loadCurrentTrack(false);
      return;
    }

    if (state.index >= state.tracks.length) state.index = 0;
    loadCurrentTrack(false);
  }, error => {
    state.loading = false;
    state.error = error instanceof Error ? error.message : "Дуунуудыг ачаалж чадсангүй.";
    notify();
  });
}

export function startMusicIntegration() {
  state.refCount += 1;
  ensureAudio();
  subscribeTracks();
  notify();
}

export function stopMusicIntegration() {
  state.refCount = Math.max(0, state.refCount - 1);
  if (state.refCount > 0) return;

  if (typeof state.unsubscribeTracks === "function") {
    state.unsubscribeTracks();
    state.unsubscribeTracks = null;
  }
}

export function subscribeMusicState(listener) {
  if (typeof listener !== "function") return () => {};
  state.listeners.add(listener);
  listener(getMusicSnapshot());
  return () => {
    state.listeners.delete(listener);
  };
}

export function getMusicSnapshot() {
  const audio = ensureAudio();
  return {
    loading: state.loading,
    error: state.error,
    tracks: [...state.tracks],
    index: state.index,
    current: getCurrentTrack(),
    paused: audio.paused,
    currentTime: durationOrZero(audio.currentTime),
    duration: durationOrZero(audio.duration),
    volume: durationOrZero(audio.volume)
  };
}

export function playTrackAt(index) {
  if (!state.tracks.length) return { ok: false, message: "Тоглуулах дуу алга." };
  const nextIndex = Number(index);
  if (!Number.isFinite(nextIndex)) return { ok: false, message: "Дууны индекс буруу байна." };
  state.index = ((Math.trunc(nextIndex) % state.tracks.length) + state.tracks.length) % state.tracks.length;
  state.error = "";
  loadCurrentTrack(true);
  return { ok: true, message: `▶ ${getCurrentTrack()?.title || "Дуу"} тоглуулж байна.` };
}

export function playTrackByName(name) {
  const query = asText(name).toLowerCase();
  if (!query) return { ok: false, message: "Дууны нэр оруулна уу." };
  const index = state.tracks.findIndex(track => {
    const search = `${track.title} ${track.artist}`.toLowerCase();
    return search.includes(query);
  });
  if (index < 0) return { ok: false, message: "Ийм нэртэй дуу олдсонгүй." };
  return playTrackAt(index);
}

export function playMusic() {
  if (!state.tracks.length) return { ok: false, message: "Тоглуулах дуу алга." };
  state.error = "";
  loadCurrentTrack(true);
  return { ok: true, message: `▶ ${getCurrentTrack()?.title || "Дуу"} тоглуулж байна.` };
}

export function pauseMusic() {
  const audio = ensureAudio();
  if (!audio.src || audio.paused) return { ok: true, message: "⏸ Дуу зогсоолттой байна." };
  audio.pause();
  notify();
  return { ok: true, message: "⏸ Дуу түр зогслоо." };
}

export function nextTrack() {
  if (!state.tracks.length) return { ok: false, message: "Дараагийн дуу алга." };
  state.index = (state.index + 1) % state.tracks.length;
  state.error = "";
  loadCurrentTrack(true);
  return { ok: true, message: `⏭ ${getCurrentTrack()?.title || "Дараагийн дуу"}` };
}

export function previousTrack() {
  if (!state.tracks.length) return { ok: false, message: "Өмнөх дуу алга." };
  state.index = (state.index - 1 + state.tracks.length) % state.tracks.length;
  state.error = "";
  loadCurrentTrack(true);
  return { ok: true, message: `⏮ ${getCurrentTrack()?.title || "Өмнөх дуу"}` };
}

export function setMusicVolume(value) {
  const audio = ensureAudio();
  const volume = Math.max(0, Math.min(1, Number(value)));
  if (!Number.isFinite(volume)) return;
  audio.volume = volume;
  notify();
}

export function parseMusicCommand(input) {
  const text = asText(input).toLowerCase();
  if (!text) return null;

  if (/^(songs|track list|дуу(нууд)?(?:ын)?\s*(жагсаалт|байгаа)|what songs)/i.test(text)) {
    return { type: "list" };
  }
  if (/(^|\s)(pause|түр\s*зогс|зогсоо|stop\s+music)(\s|$)/i.test(text)) {
    return { type: "pause" };
  }
  if (/(^|\s)(next|дараагийн)(\s|$)/i.test(text)) {
    return { type: "next" };
  }
  if (/(^|\s)(previous|prev|өмнөх)(\s|$)/i.test(text)) {
    return { type: "prev" };
  }

  const playMatch = text.match(/^(?:play|тоглуул)\s+(.+)$/i);
  if (playMatch?.[1]) return { type: "playByName", query: playMatch[1] };

  if (/(^|\s)(play|тоглуул|resume)(\s|$)/i.test(text)) {
    return { type: "play" };
  }

  return null;
}

export function runMusicCommand(command) {
  if (!command) return { handled: false, message: "" };

  if (command.type === "list") {
    if (!state.tracks.length) return { handled: true, message: "Music дээр дуу алга." };
    const top = state.tracks.slice(0, 20).map((track, index) => `${index + 1}. ${track.title} · ${track.artist}`).join("\n");
    return { handled: true, message: `Нийт ${state.tracks.length} дуу байна:\n\n${top}` };
  }
  if (command.type === "pause") return { handled: true, ...pauseMusic() };
  if (command.type === "next") return { handled: true, ...nextTrack() };
  if (command.type === "prev") return { handled: true, ...previousTrack() };
  if (command.type === "play") return { handled: true, ...playMusic() };
  if (command.type === "playByName") return { handled: true, ...playTrackByName(command.query) };

  return { handled: false, message: "" };
}

export function createMusicModule() {
  return {
    key: "music",
    title: "Music",
    description: "Music is integrated into the ONI AI route with a single shared player instance.",
    status: "live"
  };
}
