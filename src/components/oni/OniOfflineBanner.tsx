import { useEffect, useState } from "react";

/**
 * Truthful offline indicator. Live Supabase-backed data (members, garage, MEET)
 * is never cached, so we tell the user it is unavailable instead of showing stale state.
 */
export function OniOfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] bg-destructive/95 px-4 py-2 text-center text-xs font-medium tracking-wide text-destructive-foreground"
      style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
    >
      Сүлжээ алга — шууд өгөгдөл (гишүүд, гараж, MEET) одоогоор боломжгүй.
    </div>
  );
}
