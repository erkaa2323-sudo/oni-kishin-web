import { getFirebase } from "./firebase.js";
import { registerRoute, startRouter } from "./router.js";
import { createAuthModule } from "./auth.js";
import { createMembersModule } from "./members.js";
import { createGarageModule } from "./garage.js";
import { createMusicModule } from "./music.js";
import { createMeetModule } from "./meet.js";
import { createJoinModule } from "./join.js";
import { createMarketModule } from "./market.js";
import { createOniAiModule } from "./oni-ai.js";

const BASE = "/oni-kishin-web/v2/";
const modules = [
  createAuthModule(),
  createMembersModule(),
  createGarageModule(),
  createMusicModule(),
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
const navLinks = [...document.querySelectorAll(".oni-nav-link")];
const toast = document.getElementById("oniToast");
const offlineBanner = document.getElementById("offlineBanner");
const modal = document.getElementById("oniModal");
const modalBody = document.getElementById("oniModalBody");
let activeRouteTeardown = null;
let isBootstrapped = false;
let modalLastFocus = null;
let swControllerReloading = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}

function setActive(route) {
  navLinks.forEach(link => {
    const active = link.dataset.route === route;
    link.classList.toggle("is-active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });
}

function showToast(message, timeout = 2200) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, timeout);
}

function setBodyScrollLocked(locked) {
  document.body.classList.toggle("oni-modal-open", !!locked);
}

function openModal(content) {
  modalLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalBody.innerHTML = content;
  modal.hidden = false;
  setBodyScrollLocked(true);
  const closeButton = modal.querySelector("[data-modal-close]");
  if (closeButton instanceof HTMLElement) closeButton.focus();
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  setBodyScrollLocked(false);
  if (modalLastFocus instanceof HTMLElement) {
    modalLastFocus.focus();
  }
  modalLastFocus = null;
}

function card(module) {
  return `
    <article class="oni-card">
      <div class="oni-pill">${escapeHtml(module.status)}</div>
      <h3>${escapeHtml(module.title)}</h3>
      <p>${escapeHtml(module.description)}</p>
    </article>
  `;
}

function sectionHead(title, description) {
  return `
    <header class="oni-section-head">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </header>
  `;
}

function renderHome() {
  const moduleCards = modules
    .filter(module => module.key !== "auth")
    .map(card)
    .join("");

  root.innerHTML = `
    ${sectionHead("ONI HUB v2 Foundation", "Stable app shell is ready. Feature migrations are intentionally deferred.")}
    <div class="oni-stack">
      <article class="oni-card">
        <h2>Architecture readiness</h2>
        <ul class="oni-feature-list">
          <li>ES modules + centralized Firebase bootstrap</li>
          <li>Mobile-first shell with safe-area handling</li>
          <li>PWA manifest + service-worker offline strategy</li>
          <li>Legacy v1 page preserved at <code>index.html</code></li>
        </ul>
      </article>
      <section class="oni-grid" aria-label="Placeholder modules">${moduleCards}</section>
      <article class="oni-card">
        <h2>Admin & Worker</h2>
        <p>Admin v2 shell: <code>v2/admin/index.html</code></p>
        <p>Worker placeholder interface: <code>v2/worker/index.js</code></p>
        <p class="oni-muted">Production Cloudflare worker files in <code>src/</code> are unchanged.</p>
      </article>
    </div>
  `;
}

function clearRouteMount() {
  closeModal();
  if (typeof activeRouteTeardown !== "function") return;
  try {
    activeRouteTeardown();
  } catch (error) {
    console.warn("route_teardown_failed", error);
  }
  activeRouteTeardown = null;
}

function renderModulePage(routeKey, title) {
  const module = modules.find(item => item.key === routeKey);
  const description = module?.description || "This route is not yet implemented in foundation stage.";

  root.innerHTML = `
    ${sectionHead(title, "Foundation-only placeholder")}
    <div class="oni-stack">
      ${module ? card(module) : ""}
      <article class="oni-card">
        <h2>Next migration step</h2>
        <p>${escapeHtml(description)}</p>
        <p class="oni-muted">Current production logic remains preserved in <code>index.html</code>.</p>
        <button class="oni-btn oni-btn-primary" type="button" data-open-modal>Details</button>
      </article>
    </div>
  `;
}

function registerRoutes() {
  registerRoute("home", async () => {
    clearRouteMount();
    setActive("home");
    renderHome();
  });

  registerRoute("members", async () => {
    setActive("members");
    if (membersModule && typeof membersModule.mount === "function") {
      clearRouteMount();
      membersModule.mount(root);
      activeRouteTeardown = () => membersModule.unmount?.();
      return;
    }
    clearRouteMount();
    renderModulePage("members", "Members");
  });

  registerRoute("garage", async () => {
    setActive("garage");
    if (garageModule && typeof garageModule.mount === "function") {
      clearRouteMount();
      garageModule.mount(root);
      activeRouteTeardown = () => garageModule.unmount?.();
      return;
    }
    clearRouteMount();
    renderModulePage("garage", "Garage");
  });

  registerRoute("music", async () => {
    setActive("music");
    if (oniAiModule && typeof oniAiModule.mount === "function") {
      clearRouteMount();
      oniAiModule.mount(root);
      activeRouteTeardown = () => oniAiModule.unmount?.();
      return;
    }
    clearRouteMount();
    renderModulePage("music", "ONI AI");
  });

  registerRoute("meet", async () => {
    setActive("meet");
    if (meetModule && typeof meetModule.mount === "function") {
      clearRouteMount();
      meetModule.mount(root);
      activeRouteTeardown = () => meetModule.unmount?.();
      return;
    }
    clearRouteMount();
    renderModulePage("meet", "Meet");
  });

  registerRoute("join", async () => {
    setActive("join");
    if (joinModule && typeof joinModule.mount === "function") {
      clearRouteMount();
      joinModule.mount(root);
      activeRouteTeardown = () => joinModule.unmount?.();
      return;
    }
    clearRouteMount();
    renderModulePage("join", "Join");
  });
}

function setupOfflineState() {
  const update = () => {
    const online = navigator.onLine;
    offlineBanner.hidden = online;
    if (!online) showToast("Offline mode enabled");
  };

  addEventListener("online", update, { passive: true });
  addEventListener("offline", update, { passive: true });
  update();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const triggerWaitingWorker = registration => {
    if (!registration?.waiting) return;
    showToast("Update available. Reloading…", 2600);
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

    if (target.closest("[data-open-modal]")) {
      openModal("Module implementation and Firestore-bound feature migration are intentionally deferred to the next PR stage.");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || modal.hidden) return;
    event.preventDefault();
    closeModal();
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

function bootstrap() {
  if (isBootstrapped) return;
  isBootstrapped = true;
  registerRoutes();
  startRouter();
  setupOfflineState();
  setupInstallPrompt();
  setupUiActions();
  setupViewportHandling();
  registerServiceWorker();

  try {
    getFirebase();
  } catch (error) {
    console.error("firebase_init_failed", error);
    showToast("Firebase bootstrap failed");
  }

  root.setAttribute("aria-busy", "false");
  root.classList.add("ready");
}

bootstrap();
