import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type AdminToolId = "ai" | "economy" | "event" | "creator";

type AdminTool = {
  id: AdminToolId;
  code: string;
  label: string;
  sourceLabel: string;
};

const TOOLS: AdminTool[] = [
  { id: "ai", code: "AI", label: "ONI AI", sourceLabel: "ONI АДМИН ТУСЛАХ" },
  { id: "economy", code: "ONI", label: "ЭДИЙН ЗАСАГ", sourceLabel: "ONI ЭДИЙН ЗАСАГ" },
  { id: "event", code: "EV", label: "ЭВЕНТИЙН ШАГНАЛ", sourceLabel: "ЭВЕНТИЙН ШАГНАЛ" },
  { id: "creator", code: "IMG", label: "ЗУРГИЙН ХҮСЭЛТ", sourceLabel: "ЗУРГИЙН ХҮСЭЛТ" },
];

const compactText = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

function markFloatingSources() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  for (const tool of TOOLS) {
    const source = buttons.find(
      (button) =>
        compactText(button.textContent) === tool.sourceLabel &&
        window.getComputedStyle(button).position === "fixed",
    );
    if (source) source.dataset.adminFloatingSource = tool.id;
  }
}

function markAiState() {
  const aside = document.querySelector<HTMLElement>('aside[aria-label="ONI админ туслах"]');
  if (!aside) return;
  if (aside.querySelector("textarea")) aside.removeAttribute("data-admin-ai-minimized");
  else aside.dataset.adminAiMinimized = "true";
}

function markApplicationActions() {
  const section = document.querySelector<HTMLElement>('section[aria-label="АНКЕТ"]');
  if (!section) return;
  const buttons = Array.from(section.querySelectorAll<HTMLButtonElement>("button"));
  for (const button of buttons) {
    const text = compactText(button.textContent);
    if (text === "БАТЛАХ") button.dataset.adminApplicationAction = "approve";
    if (text === "ТАТГАЛЗАХ") button.dataset.adminApplicationAction = "reject";
  }
}

function scanAdminUi() {
  markFloatingSources();
  markAiState();
  markApplicationActions();
}

function openAi() {
  scanAdminUi();
  const aside = document.querySelector<HTMLElement>('aside[aria-label="ONI админ туслах"]');
  if (aside) {
    if (aside.querySelector("textarea")) return;
    aside.removeAttribute("data-admin-ai-minimized");
    const header = aside.firstElementChild;
    const toggle = header?.querySelector<HTMLButtonElement>("button");
    toggle?.click();
    return;
  }

  const trigger = document.querySelector<HTMLButtonElement>(
    'button[data-admin-floating-source="ai"]',
  );
  trigger?.click();
  window.setTimeout(() => {
    scanAdminUi();
    const reopened = document.querySelector<HTMLElement>('aside[aria-label="ONI админ туслах"]');
    if (!reopened || reopened.querySelector("textarea")) return;
    reopened.removeAttribute("data-admin-ai-minimized");
    reopened.firstElementChild?.querySelector<HTMLButtonElement>("button")?.click();
  }, 0);
}

function openTool(id: AdminToolId) {
  if (id === "ai") {
    openAi();
    return;
  }
  scanAdminUi();
  document.querySelector<HTMLButtonElement>(`button[data-admin-floating-source="${id}"]`)?.click();
}

export function OniAdminToolNav() {
  const [target, setTarget] = useState<HTMLUListElement | null>(null);

  useEffect(() => {
    const scan = () => {
      const nav = document.querySelector<HTMLUListElement>(
        'nav[aria-label="Удирдлагын хэсгүүд"] ul',
      );
      setTarget((current) => (current === nav ? current : nav));
      scanAdminUi();
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  return createPortal(
    <>
      {TOOLS.map((tool) => (
        <li key={`admin-tool-${tool.id}`} className="shrink-0 lg:bg-ink">
          <button
            type="button"
            onClick={() => openTool(tool.id)}
            className="flex min-h-[44px] w-full items-center gap-3 border border-border px-3.5 text-left text-muted-foreground transition-colors clip-notch hover:text-foreground lg:border-0 lg:py-3 lg:hover:bg-midnight/60"
          >
            <span className="hud-label shrink-0 text-crimson/70">{tool.code}</span>
            <span className="whitespace-nowrap text-[0.7rem] font-medium tracking-[0.18em]">
              {tool.label}
            </span>
          </button>
        </li>
      ))}
    </>,
    target,
  );
}
