import { collection, doc, getDoc, getDocs, limit, query, where } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirebase, getFirestoreDb, initFirebase } from "./firebase.js";
import { getCurrentRoute, navigate, registerRoute, startRouter } from "./router.js";
import { createAuthModule } from "./auth.js";
import { createMembersModule, normalizeMemberRecord } from "./members.js";
import { createGarageModule, normalizeGarageRecord } from "./garage.js";
import {
  createMeetModule,
  formatCountdown,
  getMeetState,
  normalizeMeetParticipant,
  normalizeMeetRecord,
  parseTimestampMs
} from "./meet.js";
import { subscribeMeetWorldState } from "./meet-world.js";
import { createJoinModule } from "./join.js";
import { createMarketModule } from "./market.js";
import { createOniAiModule } from "./oni-ai.js";

const BASE = "/oni-kishin-web/v2/";
const ADMIN_EMAIL = "erkaa130@gmail.com";
const HOME_BUILD_LIMIT = 12;
const HOME_CREW_LIMIT = 12;
const modules = [
  createAuthModule(),
  createMembersModule(),
  createGarageModule(),
  createMeetModule(),
  createJoinModule(),
  createMarketModule(),
  createOniAiModule()
];
const membersModule = modules.find(module => module.key === "members");
const garageModule = modules.find(module => module.key === "garage");
const meetModule = modules.find(module => module.key === "meet");
const joinModule = modules.find(module => module.key === "join");
const oniAiModule = modules.find(module => module.key === "oni-ai");

const root = document.getElementById("viewRoot");
const shell = document.getElementById("oniShell");
const navLinks = [...document.querySelectorAll(".oni-nav-link[data-route]")];
const bottomNav = document.querySelector(".oni-bottom-nav");
const moreButton = document.querySelector("[data-nav-more]");
const moreSheet = document.getElementById("oniMoreSheet");
const toast = document.getElementById("oniToast");
const offlineBanner = document.getElementById("offlineBanner");
const modal = document.getElementById("oniModal");
const modalBody = document.getElementById("oniModalBody");
const moreAdminLink = document.querySelector("[data-more-admin]");
let activeRouteTeardown = null;
let isBootstrapped = false;
let modalLastFocus = null;
let swControllerReloading = false;
let homeRenderToken = 0;
let homeCountdownTimer = 0;
let adminAuthUnsubscribe = null;
let navActiveMorph = null;
let routeSlashTimer = 0;
let meetWorldUnsubscribe = null;
let firebaseReady = false;
let firebaseBindingsReady = false;
let firebaseBootstrapPromise = null;
const FIREBASE_UI_MESSAGE = "Мэдээлэлтэй холбогдож чадсангүй.";
const FIREBASE_RETRY_LABEL = "Дахин оролдох";
const HOME_FETCH_TIMEOUT_MS = 12_000;

const ATMOSPHERE_BY_ROUTE = {
  home: "home",
  garage: "garage",
  members: "crew",
  music: "oni-ai",
  meet: "meet",
  join: "join"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
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

function roleRank(member) {
  if (member.role === "leader") return 0;
  if (member.role === "co-leader") return 1;
  if (member.role === "special") return 2;
  return 3;
}

function roleLabel(role) {
  if (role === "leader") return "LEADER";
  if (role === "co-leader") return "CO-LEADER";
  if (role === "special") return "SPECIAL";
  return "MEMBER";
}

function roleClass(role) {
  if (role === "leader") return "is-leader";
  if (role === "co-leader") return "is-co-leader";
  if (role === "special") return "is-special";
  return "is-member";
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function setAtmosphere(route) {
  const mood = ATMOSPHERE_BY_ROUTE[route] || "home";
  document.body.dataset.oniAtmosphere = mood;
}

function playRouteSlash() {
  if (prefersReducedMotion()) return;
  let slash = document.getElementById("oniRouteSlash");
  if (!(slash instanceof HTMLElement)) {
    slash = document.createElement("div");
    slash.id = "oniRouteSlash";
    slash.className = "oni-route-slash";
    slash.setAttribute("aria-hidden", "true");
    document.body.appendChild(slash);
  }
  slash.classList.remove("is-active");
  void slash.offsetWidth;
  slash.classList.add("is-active");
  clearTimeout(routeSlashTimer);
  routeSlashTimer = setTimeout(() => slash?.classList.remove("is-active"), 220);
}

function initials(text) {
  const words = asText(text).split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map(word => word.charAt(0)).join("").toUpperCase() || "ON";
}

function applyMeetWorldState(worldState) {
  const state = String(worldState || "NONE").toUpperCase();
  document.body.dataset.oniMeetState = state;
  const meetLink = navLinks.find(link => link.dataset.route === "meet");
  if (!(meetLink instanceof HTMLElement)) return;
  meetLink.classList.toggle("is-live", state === "LIVE" || state === "FULL");
}

function setActive(route) {
  const mapped = route === "members" || route === "join" ? "more" : route;

  navLinks.forEach(link => {
    const active = link.dataset.route === mapped;
    link.classList.toggle("is-active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });

  if (moreButton instanceof HTMLButtonElement) {
    const active = mapped === "more";
    moreButton.classList.toggle("is-active", active);
    moreButton.setAttribute("aria-current", active ? "page" : "false");
  }

  if (navActiveMorph instanceof HTMLElement && bottomNav instanceof HTMLElement) {
    const activeNode = mapped === "more"
      ? moreButton
      : navLinks.find(link => link.dataset.route === mapped);
    if (!(activeNode instanceof HTMLElement)) return;
    const navRect = bottomNav.getBoundingClientRect();
    const nodeRect = activeNode.getBoundingClientRect();
    const x = nodeRect.left - navRect.left + 4;
    const y = nodeRect.top - navRect.top + 4;
    navActiveMorph.style.width = `${Math.max(0, nodeRect.width - 8)}px`;
    navActiveMorph.style.height = `${Math.max(0, nodeRect.height - 8)}px`;
    navActiveMorph.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}

function showToast(message, timeout = 2200) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, timeout);
}

function isDevelopmentHost() {
  const host = (typeof location !== "undefined" && location.hostname) ? location.hostname : "";
  return host === "localhost" || host === "127.0.0.1";
}

function logDevError(label, error) {
  if (!isDevelopmentHost()) return;
  console.error(label, error);
}

function withTimeout(task, timeoutMs = HOME_FETCH_TIMEOUT_MS) {
  let timeoutId = 0;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
  });
  return Promise.race([task, timeout]).finally(() => clearTimeout(timeoutId));
}

function renderFirebaseBlockedState() {
  root.innerHTML = `
    <section class="oni-home-view">
      <article class="oni-error-state" role="alert">
        <h2>${FIREBASE_UI_MESSAGE}</h2>
        <p>Сүлжээгээ шалгаад дахин оролдоно уу.</p>
        <button type="button" class="oni-btn oni-btn-primary" data-firebase-retry>${FIREBASE_RETRY_LABEL}</button>
      </article>
    </section>
  `;
}

function stopHomeCountdown() {
  if (!homeCountdownTimer) return;
  clearInterval(homeCountdownTimer);
  homeCountdownTimer = 0;
}

function refreshBodyLock() {
  const lock = !modal.hidden || !(moreSheet?.hidden ?? true);
  document.body.classList.toggle("oni-modal-open", lock);
}

function setBodyScrollLocked(locked) {
  document.body.classList.toggle("oni-modal-open", !!locked);
}

function openModal(content) {
  modalLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalBody.innerHTML = content;
  modal.hidden = false;
  setBodyScrollLocked(true);
  refreshBodyLock();
  const closeButton = modal.querySelector("[data-modal-close]");
  if (closeButton instanceof HTMLElement) closeButton.focus();
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  setBodyScrollLocked(false);
  refreshBodyLock();
  if (modalLastFocus instanceof HTMLElement) modalLastFocus.focus();
  modalLastFocus = null;
}

function openMoreSheet() {
  if (!moreSheet || !moreButton) return;
  moreSheet.hidden = false;
  moreButton.setAttribute("aria-expanded", "true");
  refreshBodyLock();
  const firstLink = moreSheet.querySelector("a, button");
  if (firstLink instanceof HTMLElement) firstLink.focus();
}

function closeMoreSheet() {
  if (!moreSheet || moreSheet.hidden) return;
  moreSheet.hidden = true;
  moreButton?.setAttribute("aria-expanded", "false");
  refreshBodyLock();
}

function cardBadge(text) {
  const label = asText(text);
  if (!label) return "";
  return `<span class="oni-badge">${escapeHtml(label)}</span>`;
}

function buildCardsMarkup(records) {
  if (!records.length) {
    return `<article class="oni-empty-state"><p>Одоогоор build мэдээлэл алга.</p></article>`;
  }

  return records.map(record => {
    const title = pickFirstText(record.buildName, "ONI BUILD");
    const owner = pickFirstText(record.owner, "ONI MEMBER");
    const tags = [cardBadge(record.type), cardBadge(record.category)].filter(Boolean).join("");
    const media = record.image
      ? `<img src="${escapeHtml(record.image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">`
      : `<span class="oni-media-fallback" aria-hidden="true">${escapeHtml(initials(title))}</span>`;

    return `
      <a class="oni-build-card" href="#garage" aria-label="${escapeHtml(title)} build-ийг Garage дээр нээх">
        <div class="oni-build-media${record.image ? "" : " is-fallback"}">${media}</div>
        <div class="oni-build-overlay">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(owner)}</p>
          <div class="oni-build-badges">${tags}</div>
        </div>
      </a>
    `;
  }).join("");
}

function crewCardsMarkup(records) {
  if (!records.length) {
    return `<article class="oni-empty-state"><p>Одоогоор гишүүний preview алга.</p></article>`;
  }

  return records.map(member => {
    const nick = pickFirstText(member.nickname, "ONI MEMBER");
    const cpmId = pickFirstText(member.cpmId, "CPM ID");
    const avatar = member.avatarUrl
      ? `<img src="${escapeHtml(member.avatarUrl)}" alt="${escapeHtml(nick)} avatar" loading="lazy" decoding="async">`
      : `<span class="oni-media-fallback" aria-hidden="true">${escapeHtml(initials(nick))}</span>`;

    return `
      <article class="oni-crew-card ${roleClass(member.role)}">
        <div class="oni-crew-avatar${member.avatarUrl ? "" : " is-fallback"}">${avatar}</div>
        <h3>${escapeHtml(nick)}</h3>
        <p>${escapeHtml(cpmId)}</p>
        <span class="oni-role-badge">${escapeHtml(roleLabel(member.role))}</span>
      </article>
    `;
  }).join("");
}

function participantBelongsToMeet(participant, meet) {
  if (!participant || !meet) return false;
  if (participant.meetId && participant.meetId !== "current") return false;

  if (Number.isFinite(participant.meetStartMs) && Number.isFinite(meet.startAtMs)) {
    return participant.meetStartMs === meet.startAtMs;
  }

  const participantRaw = participant.meetStartRaw;
  if (participantRaw != null && meet.startAtRaw != null) {
    return String(participantRaw) === String(meet.startAtRaw);
  }

  return true;
}

function formatMeetStart(ms) {
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function renderMeetCard(meet, participantsCount) {
  const baseState = getMeetState(meet);

  if (!meet || baseState === "none") {
    return `
      <article class="oni-live-card is-empty">
        <header>
          <p class="oni-live-kicker">ONI MEET</p>
          <h3>Идэвхтэй meet алга</h3>
        </header>
        <p class="oni-live-copy">Дараагийн meet зарлагдмагц энд автоматаар харагдана.</p>
        <a class="oni-btn oni-btn-ghost" href="#meet">MEET ХЭСЭГ РҮҮ</a>
      </article>
    `;
  }

  const maxPlayers = Math.max(1, Number(meet.maxPlayers || 20) || 20);
  const count = Math.min(maxPlayers, Math.max(0, Number(participantsCount || 0)));

  if (baseState === "expired") {
    return `
      <article class="oni-live-card is-expired">
        <header>
          <p class="oni-live-kicker">ONI MEET</p>
          <h3>${escapeHtml(meet.title || "ONI MEET")}</h3>
        </header>
        <p class="oni-live-copy">Сүүлд дууссан meet · ${escapeHtml(formatMeetStart(meet.endAtMs))}</p>
        <div class="oni-live-meta"><span>${count} / ${maxPlayers}</span></div>
        <a class="oni-btn oni-btn-ghost" href="#meet">MEET ТҮҮХ</a>
      </article>
    `;
  }

  const state = baseState === "active" ? (count >= maxPlayers ? "full" : "live") : "upcoming";
  const countdownLabel = state === "live" ? "ДУУСАХ ХУГАЦАА" : state === "full" ? "ДҮҮРСЭН" : "ЭХЛЭХ ХУГАЦАА";
  const targetMs = state === "upcoming" ? meet.startAtMs : meet.endAtMs;
  const countdown = Number.isFinite(targetMs) ? formatCountdown(Math.max(0, targetMs - Date.now())) : "00:00:00";

  return `
    <article class="oni-live-card ${state === "upcoming" ? "is-upcoming" : "is-live"}">
      <header>
        <p class="oni-live-kicker">ONI MEET ${state === "upcoming" ? "UPCOMING" : state === "full" ? "FULL" : "LIVE"}</p>
        <h3>${escapeHtml(meet.title || "ONI NIGHT MEET")}</h3>
      </header>
      <p class="oni-live-copy">${escapeHtml(meet.roomLabel || "ONI & KISHIN")}</p>
      <div class="oni-live-meta">
        <span>${count} / ${maxPlayers}</span>
        <span>${escapeHtml(formatMeetStart(meet.startAtMs))}</span>
      </div>
      <div class="oni-live-countdown" data-home-meet-countdown data-home-meet-target="${Number.isFinite(targetMs) ? targetMs : 0}" data-home-meet-state="${state}">
        <small>${countdownLabel}</small>
        <strong>${countdown}</strong>
      </div>
      <a class="oni-btn oni-btn-primary" href="#meet">${state === "upcoming" ? "MEET ХҮЛЭЭХ" : state === "full" ? "MEET ДҮҮРСЭН" : "MEET РҮҮ ОРОХ"}</a>
    </article>
  `;
}

function updateMeetCountdown() {
  const node = root.querySelector("[data-home-meet-countdown]");
  if (!(node instanceof HTMLElement)) return;

  const target = Number(node.dataset.homeMeetTarget || 0);
  if (!Number.isFinite(target) || target <= 0) return;

  const state = node.dataset.homeMeetState || "upcoming";
  const strong = node.querySelector("strong");
  if (strong) strong.textContent = formatCountdown(Math.max(0, target - Date.now()));

  if (target <= Date.now()) {
    stopHomeCountdown();
    if (state === "upcoming" || state === "active") {
      renderHome();
    }
  }
}

async function fetchHomeData() {
  const db = getFirestoreDb();
  const [membersSnap, garageSnap, meetSnap, participantsSnap] = await Promise.all([
    getDocs(collection(db, "members")),
    getDocs(collection(db, "garage")),
    getDoc(doc(db, "meets", "current")),
    getDocs(query(collection(db, "meetParticipants"), where("meetId", "==", "current"), limit(180)))
  ]);

  const members = membersSnap.docs
    .map(docSnap => normalizeMemberRecord(docSnap.data(), docSnap.id))
    .sort((a, b) => {
      const rankDiff = roleRank(a) - roleRank(b);
      if (rankDiff) return rankDiff;
      return a.nickname.localeCompare(b.nickname);
    });

  const garage = garageSnap.docs
    .map(docSnap => normalizeGarageRecord(docSnap.data(), docSnap.id))
    .sort((a, b) => (b.createdAtMs - a.createdAtMs) || a.buildName.localeCompare(b.buildName));

  const meet = meetSnap.exists() ? normalizeMeetRecord(meetSnap.data(), meetSnap.id) : null;
  const participants = participantsSnap.docs
    .map(docSnap => normalizeMeetParticipant(docSnap.data(), docSnap.id))
    .filter(item => item.id !== "__counter__")
    .filter(item => participantBelongsToMeet(item, meet));

  const meetState = getMeetState(meet);
  const meetStateLabel = meetState === "active"
    ? (participants.length >= Math.max(1, Number(meet?.maxPlayers || 20) || 20) ? "FULL" : "LIVE")
    : meetState === "upcoming"
      ? "ТУН УДАХГҮЙ"
      : meetState === "expired"
        ? "ENDED"
        : "ХҮЛЭЭЛТ";

  return {
    members,
    garage,
    meet,
    participantsCount: participants.length,
    stats: {
      members: membersSnap.size,
      builds: garageSnap.size,
      meet: meetStateLabel
    }
  };
}

function homeSkeletonMarkup() {
  return `
    <section class="oni-home-view" aria-busy="true">
      <article class="oni-home-hero oni-skeleton-card" aria-hidden="true"></article>
      <section class="oni-home-actions oni-home-actions-skeleton">
        <span class="oni-skeleton-chip"></span>
        <span class="oni-skeleton-chip"></span>
        <span class="oni-skeleton-chip"></span>
        <span class="oni-skeleton-chip"></span>
      </section>
      <article class="oni-card oni-skeleton-card" aria-hidden="true"></article>
      <article class="oni-card oni-skeleton-card" aria-hidden="true"></article>
    </section>
  `;
}

function renderHomeView(data) {
  const builds = data.garage.slice(0, HOME_BUILD_LIMIT);
  const crew = data.members.slice(0, HOME_CREW_LIMIT);

  return `
    <section class="oni-home-view">
      <article class="oni-home-hero" aria-label="ONI HUB hero">
        <div class="oni-home-hero-overlay"></div>
        <div class="oni-home-hero-art" aria-hidden="true">
          <img src="../oni-kishin-logo.jpg" alt="" loading="eager" decoding="async">
        </div>
        <div class="oni-home-hero-copy">
          <p class="oni-hero-meta">ONI HUB · 鬼 • KISHIN</p>
          <h1>ONI &amp; KISHIN</h1>
          <p class="oni-hero-sub">Монголын CPM Anime Underground Clan</p>
          <div class="oni-stat-row">
            <span class="oni-stat-pill"><b>${data.stats.members}</b><small>ГИШҮҮН</small></span>
            <span class="oni-stat-pill"><b>${data.stats.builds}</b><small>BUILD</small></span>
            <span class="oni-stat-pill"><b>${escapeHtml(data.stats.meet)}</b><small>MEET</small></span>
          </div>
        </div>
      </article>

      <section class="oni-home-actions" aria-label="Түргэн үйлдлүүд">
        <a class="oni-action-tile is-ai" href="#music">ONI AI</a>
        <a class="oni-action-tile" href="#members">ГИШҮҮД</a>
        <a class="oni-action-tile" href="#garage">ГАРАЖ</a>
        <a class="oni-action-tile" href="#join">НЭГДЭХ</a>
      </section>

      <section class="oni-home-section">
        <header class="oni-section-header">
          <h2>ОНЦЛОХ BUILD</h2>
          <a href="#garage">БҮГДИЙГ ХАРАХ</a>
        </header>
        <div class="oni-carousel" data-home-builds>${buildCardsMarkup(builds)}</div>
      </section>

      <section class="oni-home-section">
        <header class="oni-section-header">
          <h2>ONI CREW</h2>
          <a href="#members">БҮГДИЙГ ХАРАХ</a>
        </header>
        <div class="oni-carousel oni-crew-carousel" data-home-crew>${crewCardsMarkup(crew)}</div>
      </section>

      <section class="oni-home-section">
        <header class="oni-section-header">
          <h2>ONI MEET</h2>
          <a href="#meet">ДЭЛГЭРЭНГҮЙ</a>
        </header>
        ${renderMeetCard(data.meet, data.participantsCount)}
      </section>
    </section>
  `;
}

async function renderHome() {
  stopHomeCountdown();
  const token = ++homeRenderToken;
  root.innerHTML = homeSkeletonMarkup();

  try {
    const data = await withTimeout(fetchHomeData());
    if (token !== homeRenderToken) return;
    root.innerHTML = renderHomeView(data);

    if (root.querySelector("[data-home-meet-countdown]")) {
      updateMeetCountdown();
      homeCountdownTimer = setInterval(updateMeetCountdown, 1000);
    }
  } catch (error) {
    if (token !== homeRenderToken) return;
    root.innerHTML = `
      <section class="oni-home-view">
        <article class="oni-error-state" role="alert">
          <h2>${FIREBASE_UI_MESSAGE}</h2>
          <p>Дахин оролдоно уу.</p>
          <button type="button" class="oni-btn oni-btn-primary" data-home-retry>ДАХИН ОРОЛДОХ</button>
        </article>
      </section>
    `;
    if (error instanceof Error) logDevError("home_render_failed", error);
  }
}

function clearRouteMount() {
  closeModal();
  closeMoreSheet();
  stopHomeCountdown();
  homeRenderToken += 1;

  if (typeof activeRouteTeardown !== "function") return;
  try {
    activeRouteTeardown();
  } catch (error) {
    console.warn("route_teardown_failed", error);
  }
  activeRouteTeardown = null;
}

function setupMeetWorldSubscription() {
  if (typeof meetWorldUnsubscribe === "function") return;
  try {
    meetWorldUnsubscribe = subscribeMeetWorldState(snapshot => {
      applyMeetWorldState(snapshot.state);
    });
  } catch (error) {
    applyMeetWorldState("NONE");
    logDevError("meet_world_subscribe_failed", error);
  }
}

function setupAdminVisibility() {
  if (!(moreAdminLink instanceof HTMLElement)) return;
  if (typeof adminAuthUnsubscribe === "function") return;

  const onAuth = user => {
    const email = asText(user?.email).toLowerCase();
    const authorized = !!email && email === ADMIN_EMAIL;
    moreAdminLink.hidden = !authorized;
  };

  try {
    const auth = getAuth(getFirebase().app);
    adminAuthUnsubscribe = onAuthStateChanged(auth, onAuth, () => onAuth(null));
  } catch {
    onAuth(null);
  }
}

function setupFirebaseBindings() {
  if (firebaseBindingsReady) return;
  setupAdminVisibility();
  setupMeetWorldSubscription();
  firebaseBindingsReady = true;
}

async function ensureFirebaseReady() {
  if (firebaseReady) return;
  if (firebaseBootstrapPromise) return firebaseBootstrapPromise;

  firebaseBootstrapPromise = initFirebase()
    .then(() => {
      firebaseReady = true;
      setupFirebaseBindings();
    })
    .catch(error => {
      firebaseReady = false;
      throw error;
    })
    .finally(() => {
      firebaseBootstrapPromise = null;
    });

  return firebaseBootstrapPromise;
}

async function runRouteWithFirebase(handler) {
  try {
    await ensureFirebaseReady();
  } catch (error) {
    logDevError("firebase_route_blocked", error);
    renderFirebaseBlockedState();
    return;
  }
  await handler();
}

function registerRoutes() {
  registerRoute("home", async () => {
    setAtmosphere("home");
    playRouteSlash();
    clearRouteMount();
    setActive("home");
    await runRouteWithFirebase(() => renderHome());
  });

  registerRoute("members", async () => {
    setAtmosphere("members");
    playRouteSlash();
    setActive("members");
    if (membersModule && typeof membersModule.mount === "function") {
      clearRouteMount();
      await runRouteWithFirebase(async () => {
        membersModule.mount(root);
        activeRouteTeardown = () => membersModule.unmount?.();
      });
      return;
    }
  });

  registerRoute("garage", async () => {
    setAtmosphere("garage");
    playRouteSlash();
    setActive("garage");
    if (garageModule && typeof garageModule.mount === "function") {
      clearRouteMount();
      await runRouteWithFirebase(async () => {
        garageModule.mount(root);
        activeRouteTeardown = () => garageModule.unmount?.();
      });
      return;
    }
  });

  registerRoute("music", async () => {
    setAtmosphere("music");
    playRouteSlash();
    setActive("music");
    if (oniAiModule && typeof oniAiModule.mount === "function") {
      clearRouteMount();
      await runRouteWithFirebase(async () => {
        oniAiModule.mount(root);
        activeRouteTeardown = () => oniAiModule.unmount?.();
      });
      return;
    }
  });

  registerRoute("meet", async () => {
    setAtmosphere("meet");
    playRouteSlash();
    setActive("meet");
    if (meetModule && typeof meetModule.mount === "function") {
      clearRouteMount();
      await runRouteWithFirebase(async () => {
        meetModule.mount(root);
        activeRouteTeardown = () => meetModule.unmount?.();
      });
      return;
    }
  });

  registerRoute("join", async () => {
    setAtmosphere("join");
    playRouteSlash();
    setActive("join");
    if (joinModule && typeof joinModule.mount === "function") {
      clearRouteMount();
      await runRouteWithFirebase(async () => {
        joinModule.mount(root);
        activeRouteTeardown = () => joinModule.unmount?.();
      });
      return;
    }
  });
}

function setupOfflineState() {
  const update = () => {
    const online = navigator.onLine;
    offlineBanner.hidden = online;
    if (!online) showToast("Офлайн горим идэвхжлээ");
  };

  addEventListener("online", update, { passive: true });
  addEventListener("offline", update, { passive: true });
  update();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const triggerWaitingWorker = registration => {
    if (!registration?.waiting) return;
    showToast("Шинэчлэл бэлэн боллоо. Дахин ачаалж байна…", 2600);
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swControllerReloading) return;
    swControllerReloading = true;
    location.reload();
  });

  try {
    const registration = await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });

    if (registration.waiting) {
      triggerWaitingWorker(registration);
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state !== "installed" || !navigator.serviceWorker.controller) return;
        triggerWaitingWorker(registration);
      });
    });

    const refreshRegistration = () => registration.update().catch(() => {});
    addEventListener("online", refreshRegistration, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshRegistration();
    }, { passive: true });
  } catch (error) {
    console.warn("sw_register_failed", error);
  }
}

function setupInstallPrompt() {
  const installButton = document.querySelector("[data-install-button]");
  if (!(installButton instanceof HTMLButtonElement)) return;

  let promptEvent;
  installButton.disabled = true;

  addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    promptEvent = event;
    installButton.disabled = false;
  });

  installButton.addEventListener("click", async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    promptEvent = null;
    installButton.disabled = true;
  });
}

function setupMoreActions() {
  if (!(moreButton instanceof HTMLButtonElement) || !(moreSheet instanceof HTMLElement)) return;

  moreButton.addEventListener("click", () => {
    if (moreSheet.hidden) openMoreSheet();
    else closeMoreSheet();
  });
}

function setupUiActions() {
  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-modal-close]")) {
      closeModal();
      return;
    }

    if (target === modal) {
      closeModal();
      return;
    }

    if (target === moreSheet) {
      closeMoreSheet();
      return;
    }

    if (target.closest("[data-more-close]")) {
      closeMoreSheet();
      return;
    }

    if (target.closest("[data-more-link]")) {
      closeMoreSheet();
      return;
    }

    if (target.closest("[data-more-info]")) {
      closeMoreSheet();
      openModal("<p>ONI &amp; KISHIN бол Монголын CPM anime underground clan. Бүх хэсэг бодит цагаар шинэчлэгдсэн мэдээллээр ажиллана.</p>");
      return;
    }

    if (target.closest("[data-home-retry]")) {
      renderHome();
      return;
    }

    if (target.closest("[data-firebase-retry]")) {
      retryFirebaseBootstrap();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!moreSheet?.hidden) {
      event.preventDefault();
      closeMoreSheet();
      return;
    }
    if (!modal.hidden) {
      event.preventDefault();
      closeModal();
    }
  });
}

function setupViewportHandling() {
  if (!shell || !window.visualViewport) return;

  let initialHeight = window.visualViewport.height;
  const update = () => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    if (viewport.height > initialHeight) initialHeight = viewport.height;
    const keyboardOpen = initialHeight - viewport.height > 120;
    document.body.classList.toggle("oni-keyboard-open", keyboardOpen);
  };

  window.visualViewport.addEventListener("resize", update, { passive: true });
  window.visualViewport.addEventListener("scroll", update, { passive: true });
  addEventListener("orientationchange", () => {
    initialHeight = window.visualViewport?.height || initialHeight;
    update();
  }, { passive: true });
  update();
}

function setupParallaxMotion() {
  if (!(shell instanceof HTMLElement) || prefersReducedMotion()) return;
  let rafId = 0;
  let targetX = 0;
  let targetY = 0;

  const apply = () => {
    rafId = 0;
    shell.style.setProperty("--oni-parallax-x", targetX.toFixed(4));
    shell.style.setProperty("--oni-parallax-y", targetY.toFixed(4));
  };

  const onMove = event => {
    const x = (event.clientX / Math.max(1, window.innerWidth)) - 0.5;
    const y = (event.clientY / Math.max(1, window.innerHeight)) - 0.5;
    targetX = x * 2;
    targetY = y * 2;
    if (!rafId) rafId = requestAnimationFrame(apply);
  };

  const onLeave = () => {
    targetX = 0;
    targetY = 0;
    if (!rafId) rafId = requestAnimationFrame(apply);
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", onLeave, { passive: true });
}

function setupNavMorph() {
  if (!(bottomNav instanceof HTMLElement)) return;
  navActiveMorph = document.createElement("span");
  navActiveMorph.className = "oni-nav-active-morph";
  navActiveMorph.setAttribute("aria-hidden", "true");
  bottomNav.prepend(navActiveMorph);
}

function spawnSuccessBurst(target) {
  if (!(target instanceof HTMLElement) || prefersReducedMotion()) return;
  const burst = document.createElement("span");
  burst.className = "oni-success-burst";
  burst.setAttribute("aria-hidden", "true");
  target.appendChild(burst);
  setTimeout(() => burst.remove(), 320);
}

function setupMotionUtilities() {
  setupNavMorph();
  setupParallaxMotion();
  window.ONI_MOTION = { successBurst: spawnSuccessBurst };
  window.addEventListener("oni:success-burst", event => {
    const target = event?.detail?.target;
    if (target instanceof HTMLElement) spawnSuccessBurst(target);
  });
}

async function retryFirebaseBootstrap() {
  try {
    await ensureFirebaseReady();
    await navigate(`#${getCurrentRoute()}`);
  } catch (error) {
    logDevError("firebase_init_failed", error);
    renderFirebaseBlockedState();
  }
}

function bootstrap() {
  if (isBootstrapped) return;
  isBootstrapped = true;
  registerRoutes();
  startRouter();
  setupOfflineState();
  setupInstallPrompt();
  setupUiActions();
  setupMoreActions();
  setupViewportHandling();
  setupMotionUtilities();
  registerServiceWorker();
  retryFirebaseBootstrap();

  root.setAttribute("aria-busy", "false");
  root.classList.add("ready");
  setAtmosphere("home");
  setActive("home");
}

addEventListener("beforeunload", () => {
  if (typeof adminAuthUnsubscribe === "function") {
    adminAuthUnsubscribe();
    adminAuthUnsubscribe = null;
  }
  if (typeof meetWorldUnsubscribe === "function") {
    meetWorldUnsubscribe();
    meetWorldUnsubscribe = null;
  }
});

bootstrap();
