const routes = new Map();
const ALLOWED_ROUTES = new Set(["home", "members", "garage", "music", "meet", "join"]);
let currentRoute = "home";

function cleanRoute(hash) {
  const key = String(hash || "home").replace(/^#/, "").trim();
  if (!key || !ALLOWED_ROUTES.has(key)) return "home";
  return key;
}

export function registerRoute(name, handler) {
  if (!ALLOWED_ROUTES.has(name)) {
    throw new Error(`Route is not allowed: ${name}`);
  }
  if (typeof handler !== "function") {
    throw new Error(`Route handler must be a function: ${name}`);
  }
  routes.set(name, handler);
}

export function getCurrentRoute() {
  return currentRoute;
}

async function runRoute(name) {
  const handler = routes.get(name);
  if (typeof handler !== "function") {
    throw new Error(`Missing route handler: ${name}`);
  }
  await handler({ route: name });
}

export async function navigate(hash) {
  const route = cleanRoute(hash);
  currentRoute = route;

  switch (route) {
    case "home":
      await runRoute("home");
      return;
    case "members":
      await runRoute("members");
      return;
    case "garage":
      await runRoute("garage");
      return;
    case "music":
      await runRoute("music");
      return;
    case "meet":
      await runRoute("meet");
      return;
    case "join":
      await runRoute("join");
      return;
    default:
      await runRoute("home");
  }
}

export function startRouter() {
  const run = () => navigate(location.hash).catch(error => {
    console.error("router_error", error);
  });

  addEventListener("hashchange", run, { passive: true });
  run();
}
