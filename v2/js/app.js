import { getFirebase } from "./firebase.js";
import { registerRoute, startRouter } from "./router.js";
import { createAuthModule } from "./auth.js";
import { createMembersModule } from "./members.js";
import { createGarageModule } from "./garage.js";
import { createMusicModule } from "./music.js";
import { createMeetModule } from "./meet.js";
import { createMarketModule } from "./market.js";
import { createOniAiModule } from "./oni-ai.js";

const BASE = "/oni-kishin-web/v2/";
const modules = [
  createAuthModule(),
  createMembersModule(),
  createGarageModule(),
  createMusicModule(),
  createMeetModule(),
  createMarketModule(),
  createOniAiModule()
];
const membersModule = modules.find(module => module.key === "members");
const garageModule = modules.find(module => module.key === "garage");

const root = document.getElementById("viewRoot");
const navLinks = [...document.querySelectorAll(".oni-nav-link")];
const toast = document.getElementById("oniToast");
const offlineBanner = document.getElementById("offlineBanner");
const modal = document.getElementById("oniModal");
const modalBody = document.getElementById("oniModalBody");
let activeRouteTeardown = null;

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

function openModal(content) {
  modalBody.innerHTML = content;
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
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
    clearRouteMount();
    setActive("music");
    renderModulePage("music", "Music");
  });

  registerRoute("meet", async () => {
    clearRouteMount();
    setActive("meet");
    renderModulePage("meet", "Meet");
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

  try {
    await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });
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

    if (target.matches("[data-modal-close]")) {
      closeModal();
      return;
    }

    if (target.matches("[data-open-modal]")) {
      openModal("Module implementation and Firestore-bound feature migration are intentionally deferred to the next PR stage.");
    }
  });
}

function bootstrap() {
  registerRoutes();
  startRouter();
  setupOfflineState();
  setupInstallPrompt();
  setupUiActions();
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
