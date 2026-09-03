import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getFirestoreDb } from "./firebase.js";

const MEET_DOC_ID = "current";
const DEFAULT_DURATION_MINUTES = 20;
const DEFAULT_MAX_PLAYERS = 20;
const COUNTER_DOC_ID = "__counter__";
const JOINED_KEY_STORAGE = "oni.v2.meet.joinedKey";
const JOINED_TOKEN_STORAGE = "oni.v2.meet.joinedToken";
const LOAD_TIMEOUT_MS = 12_000;
const LOAD_ERROR_MESSAGE = "Мэдээлэлтэй холбогдож чадсангүй.";

function setRuntimeTimeout(handler, timeoutMs) {
  if (typeof setTimeout === "function") return setTimeout(handler, timeoutMs);
  if (typeof window !== "undefined" && typeof window.setTimeout === "function") return window.setTimeout(handler, timeoutMs);
  return 0;
}

function clearRuntimeTimeout(timerId) {
  if (!timerId) return;
  if (typeof clearTimeout === "function") {
    clearTimeout(timerId);
    return;
  }
  if (typeof window !== "undefined" && typeof window.clearTimeout === "function") {
    window.clearTimeout(timerId);
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[ch]));
}

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

function toPositiveNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return number;
}

export function parseTimestampMs(value) {
  if (value == null || value === "") return NaN;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeMeetToken(rawMeet = {}) {
  const startSource = rawMeet.startAt ?? rawMeet.start ?? rawMeet.startTime ?? rawMeet.startsAt;
  const startMs = parseTimestampMs(startSource);
  if (Number.isFinite(startMs)) return `start:${startMs}`;
  const endSource = rawMeet.endAt ?? rawMeet.end ?? rawMeet.endTime ?? rawMeet.endsAt;
  const endMs = parseTimestampMs(endSource);
  if (Number.isFinite(endMs)) return `end:${endMs}`;
  const updatedMs = parseTimestampMs(rawMeet.updatedAt);
  if (Number.isFinite(updatedMs)) return `updated:${updatedMs}`;
  return MEET_DOC_ID;
}

export function normalizeMeetRecord(raw = {}, docId = MEET_DOC_ID) {
  const durationMinutes = toPositiveNumber(raw.durationMinutes ?? raw.duration ?? raw.durationMin, DEFAULT_DURATION_MINUTES);
  const startRaw = raw.startAt ?? raw.start ?? raw.startTime ?? raw.startsAt;
  const startMs = parseTimestampMs(startRaw);
  const endRaw = raw.endAt ?? raw.end ?? raw.endTime ?? raw.endsAt;
  const explicitEndMs = parseTimestampMs(endRaw);
  const endMs = Number.isFinite(explicitEndMs)
    ? explicitEndMs
    : (Number.isFinite(startMs) ? startMs + durationMinutes * 60_000 : NaN);

  const statusText = String(raw.status ?? "").toLowerCase();
  const enabled = raw.enabled === false
    ? false
    : raw.active === false
      ? false
      : statusText === "disabled" || statusText === "hidden" || statusText === "inactive"
        ? false
        : true;

  const maxPlayers = Math.max(1, Math.min(200, toPositiveNumber(
    raw.maxPlayers ?? raw.maxParticipants ?? raw.participantLimit ?? raw.capacity ?? raw.max,
    DEFAULT_MAX_PLAYERS
  )));

  const roomId = pickFirstText(raw.roomId, raw.meetId, raw.id, raw.roomCode, raw.code);
  const password = pickFirstText(raw.password, raw.pass, raw.roomPass, raw.roomPassword, raw.PASS);

  return {
    id: asText(docId) || MEET_DOC_ID,
    enabled,
    title: pickFirstText(raw.name, raw.title, raw.meetName, "ONI NIGHT MEET"),
    roomLabel: pickFirstText(raw.roomLabel, raw.description, raw.label, "ONI & KISHIN · CPM 1"),
    roomId,
    password,
    maxPlayers,
    durationMinutes,
    startAtRaw: startRaw ?? null,
    endAtRaw: endRaw ?? null,
    startAtMs: startMs,
    endAtMs: endMs,
    token: normalizeMeetToken(raw),
    raw
  };
}

export function normalizeMeetParticipant(raw = {}, docId = "") {
  const nick = pickFirstText(raw.nick, raw.nickname, raw.name, raw.memberNick, "ONI MEMBER");
  const cpmId = pickFirstText(raw.cpmId, raw.cpmid, raw.memberCpmId);
  const memberId = pickFirstText(raw.memberId, raw.playerId, raw.uid, raw.id);
  const meetStartMs = parseTimestampMs(raw.meetStartAt ?? raw.startAt);
  const joinedAtMs = parseTimestampMs(raw.joinedAt ?? raw.createdAt);

  return {
    id: asText(docId),
    nick,
    cpmId,
    memberId,
    meetId: pickFirstText(raw.meetId, raw.eventId, MEET_DOC_ID),
    meetStartMs,
    meetStartRaw: raw.meetStartAt ?? raw.startAt ?? null,
    joinedAtMs,
    raw
  };
}

export function getMeetState(meet, nowMs = Date.now()) {
  if (!meet || meet.enabled === false) return "none";
  if (!Number.isFinite(meet.startAtMs)) return "none";
  if (!Number.isFinite(meet.endAtMs)) return "none";
  if (nowMs < meet.startAtMs) return "upcoming";
  if (nowMs < meet.endAtMs) return "active";
  return "expired";
}

export function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = value => String(Math.max(0, value)).padStart(2, "0");

  if (days > 0) return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatDateTime(ms) {
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function memberNick(record = {}) {
  return pickFirstText(record.nick, record.nickname, record.cpmNick, record.name, record.first, "");
}

function memberCpmId(record = {}) {
  return pickFirstText(record.cpmid, record.cpmId, record.cpm_id, record.cpm, record.playerId, record.id, "");
}

function participantBelongsToMeet(participant, meet) {
  if (!participant || !meet) return false;
  if (participant.meetId && participant.meetId !== MEET_DOC_ID) return false;

  const participantStart = participant.meetStartMs;
  if (Number.isFinite(participantStart) && Number.isFinite(meet.startAtMs)) {
    return participantStart === meet.startAtMs;
  }

  const participantRaw = participant.meetStartRaw;
  if (participantRaw != null && meet.startAtRaw != null) {
    return String(participantRaw) === String(meet.startAtRaw);
  }

  return true;
}

function computeParticipantDocId(meetToken, memberId) {
  return `${meetToken}__${String(memberId).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function normalizeCounterSnapshot(raw = {}) {
  const count = Number(raw.count);
  return {
    token: pickFirstText(raw.meetToken, raw.token),
    count: Number.isFinite(count) && count >= 0 ? count : NaN
  };
}

function skeletonMarkup() {
  return `
    <section class="oni-meet-view" data-meet-view>
      <header class="oni-section-head">
        <h1>ONI MEET</h1>
        <p>ONI MEET-ийн шууд төлөв ачаалж байна.</p>
      </header>
      <article class="oni-card oni-meet-hero is-loading" aria-hidden="true">
        <div class="oni-meet-line"></div>
        <div class="oni-meet-line wide"></div>
        <div class="oni-meet-line"></div>
        <div class="oni-meet-grid-skeleton">
          <span></span><span></span><span></span>
        </div>
      </article>
    </section>
  `;
}

export function meetRouteMarkup() {
  return `
    <section class="oni-meet-view" data-meet-view>
      <header class="oni-section-head">
        <h1>ONI MEET</h1>
        <p>ONI MEET-ийн бодит цагийн төлөв, бүртгэл, болон event мэдээлэл.</p>
      </header>

      <article class="oni-card oni-meet-hero" data-meet-hero>
        <p class="oni-meet-kicker">ONI / KISHIN ШУУД EVENT</p>
        <div class="oni-meet-hero-head">
          <div>
            <p class="oni-meet-state" data-meet-state-pill>ИДЭВХГҮЙ</p>
            <h2 data-meet-title>ONI NIGHT MEET</h2>
            <p class="oni-meet-sub" data-meet-room-label>ONI &amp; KISHIN · CPM 1</p>
          </div>
          <button type="button" class="oni-btn oni-btn-ghost" data-meet-retry>ДАХИН ОРОЛДОХ</button>
        </div>

        <div class="oni-meet-countdown-box">
          <small data-meet-countdown-label>ЭХЛЭХ ХУГАЦАА</small>
          <strong data-meet-countdown>00:00:00</strong>
        </div>

        <div class="oni-meet-meta-grid">
          <div class="oni-meet-meta-item"><small>ЭХЛЭХ</small><b data-meet-start>—</b></div>
          <div class="oni-meet-meta-item"><small>ДУУСАХ</small><b data-meet-end>—</b></div>
          <div class="oni-meet-meta-item"><small>ОРОЛЦОГЧ</small><b data-meet-capacity>0 / ${DEFAULT_MAX_PLAYERS}</b></div>
        </div>

        <div class="oni-meet-secret-grid">
          <label class="oni-meet-secret">
            <small>MEET ID</small>
            <code data-meet-room-id>—</code>
          </label>
          <button type="button" class="oni-btn oni-btn-ghost" data-copy-target="roomId">ID ХУУЛАХ</button>
          <label class="oni-meet-secret">
            <small>НУУЦ ҮГ</small>
            <code data-meet-password>НУУЦЛАГДСАН</code>
          </label>
          <button type="button" class="oni-btn oni-btn-ghost" data-copy-target="password">НУУЦ ҮГ ХУУЛАХ</button>
        </div>

        <form class="oni-meet-form" data-meet-form novalidate>
          <label class="oni-meet-field">
            <span>CPM нэр</span>
            <input data-meet-nick type="text" maxlength="50" autocomplete="nickname" required placeholder="Kitsune">
          </label>
          <label class="oni-meet-field">
            <span>CPM ID</span>
            <input data-meet-cpm type="text" maxlength="40" autocomplete="off" required placeholder="ONI0001">
          </label>
          <button type="submit" class="oni-btn oni-btn-primary" data-meet-join>MEET-Д НЭГДЭХ</button>
        </form>

        <p class="oni-meet-inline-state" data-meet-registration-state role="status" aria-live="polite"></p>
        <p class="oni-meet-inline-error" data-meet-error role="alert"></p>
      </article>

      <article class="oni-card oni-meet-participants" data-meet-participants-card>
        <div class="oni-meet-participants-head">
          <h3>Оролцогчид</h3>
          <small data-meet-participants-count>0 / ${DEFAULT_MAX_PLAYERS}</small>
        </div>
        <div class="oni-meet-participant-list" data-meet-participant-list></div>
      </article>
    </section>
  `;
}

export function createMeetModule() {
  let host = null;
  let isMounted = false;
  let requestId = 0;
  let timerId = 0;
  let loadWatchdogId = 0;

  let meet = null;
  let members = [];
  let participants = [];
  let joinedKey = "";
  let joinedMeetToken = "";
  let loading = true;
  let registering = false;
  let errorMessage = "";
  let registrationMessage = "";
  let watcherGeneration = 0;

  let unsubscribeMeet = null;
  let unsubscribeParticipants = null;
  let unsubscribeMembers = null;

  const dispose = [];

  function clearListeners() {
    while (dispose.length) {
      const fn = dispose.pop();
      try {
        fn();
      } catch {
        // Ignore cleanup failures.
      }
    }
  }

  function stopTimer() {
    if (!timerId) return;
    clearInterval(timerId);
    timerId = 0;
  }

  function clearLoadWatchdog() {
    if (!loadWatchdogId) return;
    clearRuntimeTimeout(loadWatchdogId);
    loadWatchdogId = 0;
  }

  function startLoadWatchdog() {
    clearLoadWatchdog();
    loadWatchdogId = setRuntimeTimeout(() => {
      if (!isMounted || !loading) return;
      loading = false;
      errorMessage = LOAD_ERROR_MESSAGE;
      render();
    }, LOAD_TIMEOUT_MS);
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      if (!isMounted) return;
      render();
    }, 1000);
  }

  function clearSnapshots() {
    if (typeof unsubscribeMeet === "function") unsubscribeMeet();
    if (typeof unsubscribeParticipants === "function") unsubscribeParticipants();
    if (typeof unsubscribeMembers === "function") unsubscribeMembers();
    unsubscribeMeet = null;
    unsubscribeParticipants = null;
    unsubscribeMembers = null;
  }

  function readJoinedState() {
    try {
      const storedKey = localStorage.getItem(JOINED_KEY_STORAGE) || "";
      const storedToken = localStorage.getItem(JOINED_TOKEN_STORAGE) || "";
      joinedKey = storedKey;
      joinedMeetToken = storedToken;
    } catch {
      joinedKey = "";
      joinedMeetToken = "";
    }
  }

  function saveJoinedState() {
    try {
      if (joinedKey && joinedMeetToken) {
        localStorage.setItem(JOINED_KEY_STORAGE, joinedKey);
        localStorage.setItem(JOINED_TOKEN_STORAGE, joinedMeetToken);
      } else {
        localStorage.removeItem(JOINED_KEY_STORAGE);
        localStorage.removeItem(JOINED_TOKEN_STORAGE);
      }
    } catch {
      // Ignore storage failure.
    }
  }

  function updateJoinedForCurrentMeet() {
    if (!meet || !joinedKey || !joinedMeetToken) return;
    if (joinedMeetToken !== meet.token) {
      joinedKey = "";
      joinedMeetToken = "";
      saveJoinedState();
    }
  }

  function resolveNodes() {
    if (!(host instanceof HTMLElement)) return {};
    return {
      statePill: host.querySelector("[data-meet-state-pill]"),
      title: host.querySelector("[data-meet-title]"),
      roomLabel: host.querySelector("[data-meet-room-label]"),
      countdownLabel: host.querySelector("[data-meet-countdown-label]"),
      countdown: host.querySelector("[data-meet-countdown]"),
      start: host.querySelector("[data-meet-start]"),
      end: host.querySelector("[data-meet-end]"),
      capacity: host.querySelector("[data-meet-capacity]"),
      participantsCount: host.querySelector("[data-meet-participants-count]"),
      roomId: host.querySelector("[data-meet-room-id]"),
      password: host.querySelector("[data-meet-password]"),
      participantList: host.querySelector("[data-meet-participant-list]"),
      registrationState: host.querySelector("[data-meet-registration-state]"),
      error: host.querySelector("[data-meet-error]"),
      form: host.querySelector("[data-meet-form]"),
      joinButton: host.querySelector("[data-meet-join]"),
      nickInput: host.querySelector("[data-meet-nick]"),
      cpmInput: host.querySelector("[data-meet-cpm]")
    };
  }

  function renderParticipantList(container, list) {
    if (!(container instanceof HTMLElement)) return;
    if (!list.length) {
      container.innerHTML = '<p class="oni-meet-empty">Одоогоор бүртгэл алга.</p>';
      return;
    }

    container.innerHTML = list
      .slice(0, 120)
      .map((item, index) => `
        <article class="oni-meet-participant-row">
          <b>${String(index + 1).padStart(2, "0")}</b>
          <span>${escapeHtml(item.nick)}</span>
          <small>${escapeHtml(item.cpmId || "CPM ID")}</small>
        </article>
      `)
      .join("");
  }

  function render() {
    if (!(host instanceof HTMLElement) || !isMounted) return;

    const nodes = resolveNodes();
    const currentMeet = meet;
    const state = getMeetState(currentMeet);
    const now = Date.now();
    const hasJoinedCurrentMeet = !!(joinedKey && currentMeet && joinedMeetToken === currentMeet.token);

    const maxPlayers = currentMeet ? currentMeet.maxPlayers : DEFAULT_MAX_PLAYERS;
    const visibleParticipants = state === "expired" ? [] : participants;
    const count = Math.min(maxPlayers, visibleParticipants.length);
    const isFull = count >= maxPlayers;

    if (nodes.title) nodes.title.textContent = currentMeet?.title || "ONI NIGHT MEET";
    if (nodes.roomLabel) nodes.roomLabel.textContent = currentMeet?.roomLabel || "ONI & KISHIN · CPM 1";
    if (nodes.start) nodes.start.textContent = formatDateTime(currentMeet?.startAtMs);
    if (nodes.end) nodes.end.textContent = formatDateTime(currentMeet?.endAtMs);
    if (nodes.capacity) nodes.capacity.textContent = `${count} / ${maxPlayers}`;
    if (nodes.participantsCount) nodes.participantsCount.textContent = `${count} / ${maxPlayers}`;

    if (nodes.roomId) nodes.roomId.textContent = currentMeet?.roomId || "—";
    if (nodes.password) {
      nodes.password.textContent = hasJoinedCurrentMeet && currentMeet?.password ? currentMeet.password : "НУУЦЛАГДСАН";
    }

    if (nodes.registrationState) {
      if (registrationMessage) nodes.registrationState.textContent = registrationMessage;
      else if (hasJoinedCurrentMeet) nodes.registrationState.textContent = "Та энэ meet-д бүртгэлтэй байна.";
      else nodes.registrationState.textContent = "";
    }

    if (nodes.error) nodes.error.textContent = errorMessage;

    if (nodes.joinButton) {
      nodes.joinButton.disabled = registering || state !== "active" || isFull || !currentMeet;
      if (registering) nodes.joinButton.textContent = "Бүртгэж байна...";
      else if (!currentMeet || state === "none") nodes.joinButton.textContent = "MEET АЛГА";
      else if (state === "upcoming") nodes.joinButton.textContent = "ЭХЛЭХЭЭР НЭЭГДЭНЭ";
      else if (state === "expired") nodes.joinButton.textContent = "MEET ДУУССАН";
      else if (isFull) nodes.joinButton.textContent = "ДҮҮРСЭН";
      else if (hasJoinedCurrentMeet) nodes.joinButton.textContent = "БҮРТГҮҮЛСЭН";
      else nodes.joinButton.textContent = "MEET-Д НЭГДЭХ";
    }

    if (nodes.statePill && nodes.countdownLabel && nodes.countdown) {
      if (!currentMeet || state === "none") {
        nodes.statePill.textContent = loading ? "АЧААЛЖ БАЙНА" : "ИДЭВХГҮЙ";
        nodes.countdownLabel.textContent = "ONI MEET";
        nodes.countdown.textContent = loading ? "—" : "ДАРААГИЙН MEET ХҮЛЭЭЖ БАЙНА";
      } else if (state === "upcoming") {
        nodes.statePill.textContent = "ТУН УДАХГҮЙ";
        nodes.countdownLabel.textContent = "ЭХЛЭХ ХУГАЦАА";
        nodes.countdown.textContent = formatCountdown(currentMeet.startAtMs - now);
      } else if (state === "active") {
        nodes.statePill.textContent = isFull ? "ДҮҮРСЭН" : "ШУУД";
        nodes.countdownLabel.textContent = isFull ? "ДҮҮРСЭН" : "ДУУСАХ ХУГАЦАА";
        nodes.countdown.textContent = formatCountdown(currentMeet.endAtMs - now);
      } else {
        nodes.statePill.textContent = "ДУУССАН";
        nodes.countdownLabel.textContent = "MEET ДУУССАН";
        nodes.countdown.textContent = "00:00:00";
      }
    }

    renderParticipantList(nodes.participantList, visibleParticipants);
  }

  function findMemberByInputs(nickInput, cpmInput) {
    const targetNick = asText(nickInput).toLowerCase();
    const targetCpm = asText(cpmInput).toLowerCase();
    if (!targetNick || !targetCpm) return null;

    return members.find(member => {
      return memberNick(member).toLowerCase() === targetNick
        && memberCpmId(member).toLowerCase() === targetCpm;
    }) || null;
  }

  async function fetchCurrentMeetParticipantCount(db, currentMeet) {
    try {
      const snapshot = await getDocs(query(collection(db, "meetParticipants"), where("meetId", "==", MEET_DOC_ID)));
      const items = snapshot.docs
        .map(item => normalizeMeetParticipant(item.data(), item.id))
        .filter(item => item.id !== COUNTER_DOC_ID)
        .filter(item => participantBelongsToMeet(item, currentMeet));
      return items.length;
    } catch {
      return participants.length;
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (registering || !isMounted || !host) return;

    const token = ++requestId;
    const nodes = resolveNodes();
    const nick = asText(nodes.nickInput?.value);
    const cpmId = asText(nodes.cpmInput?.value).toUpperCase();

    registrationMessage = "";
    errorMessage = "";

    if (!nick || !cpmId) {
      errorMessage = "CPM Nick болон CPM ID-аа бөглөнө үү.";
      render();
      return;
    }

    const currentMeet = meet;
    if (!currentMeet || getMeetState(currentMeet) !== "active") {
      errorMessage = "Одоогоор meet идэвхгүй байна.";
      render();
      return;
    }

    const member = findMemberByInputs(nick, cpmId);
    if (!member) {
      errorMessage = "Nick болон CPM ID тохирсонгүй.";
      render();
      return;
    }

    const resolvedMemberId = asText(member.id);
    if (!resolvedMemberId) {
      errorMessage = "Гишүүний мэдээлэл дутуу байна.";
      render();
      return;
    }

    const participantKey = computeParticipantDocId(currentMeet.token, resolvedMemberId);

    if (participants.some(item => item.id === participantKey)) {
      joinedKey = participantKey;
      joinedMeetToken = currentMeet.token;
      saveJoinedState();
      registrationMessage = "Та аль хэдийн бүртгүүлсэн байна.";
      render();
      return;
    }

    registering = true;
    render();

    try {
      const db = getFirestoreDb();
      const fallbackCount = await fetchCurrentMeetParticipantCount(db, currentMeet);
      if (token !== requestId || !isMounted) return;

      const joinResult = await runTransaction(db, async transaction => {
        const meetRef = doc(db, "meets", MEET_DOC_ID);
        const counterRef = doc(db, "meetParticipants", COUNTER_DOC_ID);
        const participantRef = doc(db, "meetParticipants", participantKey);

        const [meetSnapshot, counterSnapshot, participantSnapshot] = await Promise.all([
          transaction.get(meetRef),
          transaction.get(counterRef),
          transaction.get(participantRef)
        ]);

        if (!meetSnapshot.exists()) throw new Error("MEET_CLOSED");
        const liveMeet = normalizeMeetRecord(meetSnapshot.data(), meetSnapshot.id);
        if (liveMeet.token !== currentMeet.token) throw new Error("MEET_CHANGED");
        if (getMeetState(liveMeet) !== "active") throw new Error("MEET_CLOSED");

        if (participantSnapshot.exists()) {
          return { duplicate: true, meetToken: liveMeet.token };
        }

        const counter = counterSnapshot.exists()
          ? normalizeCounterSnapshot(counterSnapshot.data())
          : { token: "", count: NaN };
        const shouldRebaseCounter = !Number.isFinite(counter.count) || counter.token !== liveMeet.token;
        const currentCount = shouldRebaseCounter ? fallbackCount : counter.count;

        if (currentCount >= liveMeet.maxPlayers) throw new Error("MEET_FULL");

        transaction.set(participantRef, {
          meetId: MEET_DOC_ID,
          meetStartAt: liveMeet.startAtRaw ?? liveMeet.startAtMs,
          memberId: resolvedMemberId,
          nick: memberNick(member) || nick,
          name: memberNick(member) || nick,
          cpmId: memberCpmId(member) || cpmId,
          joinedAt: serverTimestamp(),
          source: "website"
        });

        transaction.set(counterRef, {
          kind: "counter",
          meetToken: liveMeet.token,
          count: currentCount + 1,
          updatedAt: serverTimestamp(),
          updatedBy: "v2-meet-client"
        }, { merge: true });

        return { duplicate: false, meetToken: liveMeet.token };
      });

      if (token !== requestId || !isMounted) return;

      joinedKey = participantKey;
      joinedMeetToken = joinResult.meetToken;
      saveJoinedState();
      registrationMessage = joinResult.duplicate
        ? "Та аль хэдийн бүртгүүлсэн байна."
        : "Амжилттай бүртгэгдлээ.";
      errorMessage = "";
      if (!joinResult.duplicate && nodes.form) nodes.form.reset();
    } catch (error) {
      if (token !== requestId || !isMounted) return;

      if (error instanceof Error && error.message === "MEET_FULL") {
        errorMessage = "Meet дүүрсэн байна. Дараагийнхыг хүлээнэ үү.";
      } else if (error instanceof Error && error.message === "MEET_CLOSED") {
        errorMessage = "Meet аль хэдийн дууссан байна.";
      } else if (error instanceof Error && error.message === "MEET_CHANGED") {
        errorMessage = "Meet шинэчлэгдсэн байна. Дахин оролдоно уу.";
      } else {
        errorMessage = LOAD_ERROR_MESSAGE;
      }
    } finally {
      if (token !== requestId || !isMounted) return;
      registering = false;
      render();
    }
  }

  function handleCopyClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const copyButton = target.closest("[data-copy-target]");
    if (!(copyButton instanceof HTMLButtonElement)) return;

    const kind = copyButton.dataset.copyTarget;
    const value = kind === "roomId"
      ? (meet?.roomId || "")
      : kind === "password"
        ? ((joinedKey && joinedMeetToken === meet?.token) ? (meet?.password || "") : "")
        : "";

    if (!value || !navigator.clipboard?.writeText) {
      registrationMessage = "Одоогоор хуулах мэдээлэл алга.";
      render();
      return;
    }

    navigator.clipboard.writeText(value)
      .then(() => {
        if (!isMounted) return;
        registrationMessage = kind === "roomId" ? "Meet ID хуулагдлаа." : "PASS хуулагдлаа.";
        errorMessage = "";
        render();
      })
      .catch(() => {
        if (!isMounted) return;
        registrationMessage = "Хуулахад алдаа гарлаа. Гараар хуулна уу.";
        render();
      });
  }

  function bindDomListeners() {
    const retryButton = host?.querySelector("[data-meet-retry]");
    const form = host?.querySelector("[data-meet-form]");

    if (retryButton instanceof HTMLButtonElement) {
      const onRetry = () => {
        errorMessage = "";
        registrationMessage = "";
        reconnectMeetSubscriptions();
      };
      retryButton.addEventListener("click", onRetry, { passive: true });
      dispose.push(() => retryButton.removeEventListener("click", onRetry));
    }

    if (form instanceof HTMLFormElement) {
      form.addEventListener("submit", handleRegister);
      dispose.push(() => form.removeEventListener("submit", handleRegister));
    }

    const onClick = event => handleCopyClick(event);
    host?.addEventListener("click", onClick);
    dispose.push(() => host?.removeEventListener("click", onClick));
  }

  function watchMeet() {
    const generation = ++watcherGeneration;
    const db = getFirestoreDb();
    startLoadWatchdog();

    unsubscribeMembers = onSnapshot(collection(db, "members"), snapshot => {
      if (!isMounted || generation !== watcherGeneration) return;
      members = snapshot.docs.map(record => ({ id: record.id, ...record.data() }));
    }, () => {
      if (!isMounted || generation !== watcherGeneration) return;
      members = [];
    });

    unsubscribeMeet = onSnapshot(doc(db, "meets", MEET_DOC_ID), snapshot => {
      if (!isMounted || generation !== watcherGeneration) return;

      const next = snapshot.exists() ? normalizeMeetRecord(snapshot.data(), snapshot.id) : null;
      const previousToken = meet?.token || "";
      meet = next;
      loading = false;
      clearLoadWatchdog();
      updateJoinedForCurrentMeet();

      if (typeof unsubscribeParticipants === "function") {
        unsubscribeParticipants();
        unsubscribeParticipants = null;
      }

      participants = [];

      if (meet && meet.enabled) {
        unsubscribeParticipants = onSnapshot(
          query(collection(db, "meetParticipants"), where("meetId", "==", MEET_DOC_ID)),
          joinedSnapshot => {
            if (!isMounted || generation !== watcherGeneration) return;

            participants = joinedSnapshot.docs
              .map(item => normalizeMeetParticipant(item.data(), item.id))
              .filter(item => item.id !== COUNTER_DOC_ID)
              .filter(item => participantBelongsToMeet(item, meet))
              .sort((a, b) => (a.joinedAtMs || 0) - (b.joinedAtMs || 0));

            if (meet?.token !== previousToken && joinedKey && joinedMeetToken !== meet?.token) {
              joinedKey = "";
              joinedMeetToken = "";
              saveJoinedState();
            }
            render();
          },
          () => {
            if (!isMounted || generation !== watcherGeneration) return;
            participants = [];
            render();
          }
        );
      }

      render();
    }, error => {
      if (!isMounted || generation !== watcherGeneration) return;
      loading = false;
      clearLoadWatchdog();
      meet = null;
      participants = [];
      errorMessage = LOAD_ERROR_MESSAGE;
      if (error instanceof Error) console.error("meet_watch_failed", error);
      render();
    });
  }

  function reconnectMeetSubscriptions() {
    if (!isMounted) return;
    clearSnapshots();
    watcherGeneration += 1;
    loading = true;
    meet = null;
    participants = [];
    members = [];
    startLoadWatchdog();
    watchMeet();
    render();
  }

  return {
    key: "meet",
    title: "Meet",
    description: "Meet route with production-compatible meets/current and meetParticipants integration.",
    status: "live",

    mount(root) {
      if (!(root instanceof HTMLElement)) return;
      if (isMounted && host === root) return;

      this.unmount();

      host = root;
      isMounted = true;
      requestId += 1;
      loading = true;
      registering = false;
      errorMessage = "";
      registrationMessage = "";
      meet = null;
      participants = [];
      members = [];
      readJoinedState();

      host.innerHTML = skeletonMarkup();
      host.innerHTML = meetRouteMarkup();
      bindDomListeners();
      startTimer();
      startLoadWatchdog();
      watchMeet();
      render();
    },

    unmount() {
      isMounted = false;
      requestId += 1;
      stopTimer();
      clearLoadWatchdog();
      clearListeners();
      clearSnapshots();
      watcherGeneration += 1;

      host = null;
      meet = null;
      participants = [];
      members = [];
      loading = true;
      registering = false;
      errorMessage = "";
      registrationMessage = "";
    }
  };
}
