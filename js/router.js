const routes = new Map();
let currentRoute = "home";

function cleanRoute(hash) {
  const key = String(hash || "home").replace(/^#/, "").trim();
  return key || "home";
}

export function registerRoute(name, handler) {
  routes.set(name, handler);
}

export function getCurrentRoute() {
  return currentRoute;
}

export async function navigate(hash) {
  const route = cleanRoute(hash);
  const fallback = routes.get("home");
  const handler = routes.get(route) || fallback;
  currentRoute = routes.has(route) ? route : "home";

  if (!handler) {
    throw new Error("Missing route handler for home");
  }

  await handler({ route: currentRoute });
}

export function startRouter() {
  const run = () => navigate(location.hash).catch(error => {
    console.error("router_error", error);
  });

  addEventListener("hashchange", run, { passive: true });
  run();
}
