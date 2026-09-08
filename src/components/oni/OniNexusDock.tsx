import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Share, Smartphone, X } from "lucide-react";
import { watchMemberAuth } from "@/data/member-auth";
import {
  enableNexusPush,
  getNexusPushState,
  isIosDevice,
  isNexusStandalone,
  type NexusPushState,
} from "@/lib/nexus-push";

const STORAGE_KEY = "oni:nexus:dismissed";

function copyFor(state: NexusPushState) {
  switch (state) {
    case "install_required":
      return {
        title: "ONI NEXUS",
        body: "Share → Add to Home Screen → Open as Web App",
        action: "HOME SCREEN",
        icon: Smartphone,
      };
    case "prompt":
      return {
        title: "SHIZUKI PUSH",
        body: "Meet зарлагдахад Shizuki шууд мэдэгдэнэ.",
        action: "ИДЭВХЖҮҮЛЭХ",
        icon: Bell,
      };
    case "config_required":
      return {
        title: "ONI NEXUS",
        body: "Push backend key бэлтгэгдэж байна.",
        action: "ТОХИРГОО",
        icon: Bell,
      };
    case "signed_out":
      return {
        title: "ONI NEXUS",
        body: "Push авахын тулд member account-аар нэвтэрнэ.",
        action: "MEMBER",
        icon: Smartphone,
      };
    case "approval_required":
      return {
        title: "ONI NEXUS",
        body: "Push нь баталгаажсан member-д нээлттэй.",
        action: "PENDING",
        icon: Smartphone,
      };
    case "denied":
      return {
        title: "SHIZUKI PUSH",
        body: "iPhone Settings → Notifications → ONI NEXUS хэсгээс зөвшөөрнө.",
        action: "BLOCKED",
        icon: Bell,
      };
    case "enabled":
      return {
        title: "SHIZUKI PUSH",
        body: "Шинэ Meet мэдэгдэл идэвхтэй.",
        action: "ONLINE",
        icon: Check,
      };
    default:
      return {
        title: "ONI NEXUS",
        body: "Энэ төхөөрөмж Web Push дэмжихгүй байна.",
        action: "UNSUPPORTED",
        icon: Smartphone,
      };
  }
}

export function OniNexusDock() {
  const [state, setState] = useState<NexusPushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setIos(isIosDevice());
    setStandalone(isNexusStandalone());
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    const refresh = () =>
      void getNexusPushState()
        .then(setState)
        .catch(() => setState("unsupported"));
    refresh();
    const stop = watchMemberAuth(refresh, refresh);
    const visibility = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const content = useMemo(() => (state ? copyFor(state) : null), [state]);
  if (!state || !content || dismissed || state === "enabled" || state === "unsupported")
    return null;
  if (!ios && state === "install_required") return null;

  const Icon = content.icon;
  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const activate = async () => {
    if (state === "install_required") {
      setNotice("Safari/Browser-ийн Share товч → Add to Home Screen → Open as Web App.");
      return;
    }
    if (state !== "prompt") return;
    setBusy(true);
    setNotice("");
    const result = await enableNexusPush().catch(() => ({
      ok: false as const,
      state: "unsupported" as const,
      message: "Push идэвхжүүлэхэд алдаа гарлаа.",
    }));
    setBusy(false);
    setNotice(result.message);
    setState(result.state);
  };

  return (
    <aside
      className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-[58] mx-auto max-w-md border border-crimson/45 bg-ink/95 p-3 shadow-2xl backdrop-blur-xl clip-notch lg:left-auto lg:right-5 lg:w-[24rem]"
      aria-label="ONI NEXUS"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center border border-crimson/45 bg-crimson/12 text-crimson clip-notch">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="hud-label text-crimson/85">{content.title}</span>
            {standalone ? <span className="hud-label text-[.48rem]">APP MODE</span> : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{content.body}</p>
          {notice ? (
            <p className="mt-2 text-[.68rem] leading-relaxed text-foreground/85">{notice}</p>
          ) : null}
          <button
            type="button"
            onClick={activate}
            disabled={busy || (state !== "prompt" && state !== "install_required")}
            className="mt-3 inline-flex min-h-10 items-center gap-2 border border-crimson/50 bg-crimson/12 px-3 text-[.58rem] font-semibold tracking-[.18em] text-foreground clip-notch disabled:opacity-60"
          >
            {state === "install_required" ? (
              <Share className="h-3.5 w-3.5" />
            ) : (
              <Bell className="h-3.5 w-3.5" />
            )}
            {busy ? "ИДЭВХЖҮҮЛЖ БАЙНА…" : content.action}
          </button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Nexus мэдэгдэл хаах"
          className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground clip-notch"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
