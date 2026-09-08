import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import mobileAppCss from "../mobile-app.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initPwa } from "../lib/pwa";
import { OniOfflineBanner } from "../components/oni/OniOfflineBanner";
import { OniWorldTransition } from "../components/oni/OniWorldTransition";
import { OniNexusDock } from "../components/oni/OniNexusDock";
import { NexusMeetPushBridge } from "../components/oni/NexusMeetPushBridge";
import { OniProgressionRewardBridge } from "../components/oni/OniProgressionRewardBridge";
import { OniCosmeticBridge } from "../components/oni/OniCosmeticBridge";

const RECOVERY_KEY = "oni:last-hard-recovery";
const isRecoverableClientLoadError = (error: Error) => /Failed to fetch dynamically imported module|Importing a module script failed|Load failed|ChunkLoadError|error loading dynamically imported module/i.test(`${error.name} ${error.message}`);

async function hardRecover() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.filter((key) => key.startsWith("oni-")).map((key) => caches.delete(key)));
    }
  } catch (error) { console.warn("ONI recovery cleanup failed", error); }
  window.location.replace(`/?fresh=${Date.now()}`);
}

function NotFoundComponent() {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-7xl font-bold text-foreground">404</h1><h2 className="mt-4 text-xl font-semibold text-foreground">Хуудас олдсонгүй</h2><p className="mt-2 text-sm text-muted-foreground">Таны хайсан хуудас байхгүй эсвэл шилжсэн байна.</p><div className="mt-6"><Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Нүүр хуудас</Link></div></div></div>;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const diagnostic = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component", diagnostic });
    if (!isRecoverableClientLoadError(error)) return;
    const last = Number(sessionStorage.getItem(RECOVERY_KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    void hardRecover();
  }, [error, diagnostic]);
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><h1 className="text-xl font-semibold tracking-tight text-foreground">Хуудас ачаалагдсангүй</h1><p className="mt-2 text-sm text-muted-foreground">Түр алдаа гарлаа. Доорх алдааны кодыг ашиглан яг шалтгааныг засна.</p><pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-black/30 p-3 text-left text-xs text-red-300" data-testid="oni-client-error">{diagnostic}</pre><div className="mt-6 flex flex-wrap justify-center gap-2"><button onClick={() => void hardRecover()} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Шинээр ачаалах</button><button onClick={reset} className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground">Дахин оролдох</button></div></div></div>;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }, { name: "theme-color", content: "#0a0a0d" }, { title: "ONI NEXUS — Oni And Kishin" }, { name: "description", content: "ONI NEXUS — Oni And Kishin-ийн iPhone standalone app, Shizuki AI, Meet, Crew, Garage болон push notification төв." }, { property: "og:site_name", content: "ONI NEXUS" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "mobile-web-app-capable", content: "yes" }, { name: "apple-mobile-web-app-capable", content: "yes" }, { name: "apple-mobile-web-app-title", content: "ONI NEXUS" }, { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" }, { name: "application-name", content: "ONI NEXUS" }], links: [{ rel: "stylesheet", href: appCss }, { rel: "stylesheet", href: mobileAppCss }, { rel: "preconnect", href: "https://fonts.googleapis.com" }, { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Rubik:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" }, { rel: "icon", type: "image/png", href: "/favicon.png" }, { rel: "manifest", href: "/manifest.webmanifest" }, { rel: "apple-touch-icon", href: "/icons/apple-touch-icon-v2.png", sizes: "180x180" }] }),
  shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) { return <html lang="mn"><head><HeadContent /></head><body>{children}<Scripts /></body></html>; }
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { initPwa(); }, []);
  return <QueryClientProvider client={queryClient}>
    <NexusMeetPushBridge />
    <OniProgressionRewardBridge />
    <OniCosmeticBridge />
    <OniOfflineBanner />
    <OniWorldTransition><Outlet /></OniWorldTransition>
    <OniNexusDock />
  </QueryClientProvider>;
}
