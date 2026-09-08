import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMyCosmetics } from "@/hooks/useMyCosmetics";
import type { OniFxId } from "@/lib/cosmetics/oni-fx-presets";
import { OniCosmeticFx } from "./OniCosmeticFx";

function requestedRouteFx(pathname: string): OniFxId[] {
  if (pathname.startsWith("/garage")) return ["garage-neon"];
  if (pathname.startsWith("/oni-ai")) return ["shizuki-kitsune"];
  if (pathname.startsWith("/meet")) return ["entrance-kishin"];
  if (pathname.startsWith("/gallery")) return ["creator-red-moon"];
  if (pathname.startsWith("/crew")) return ["title-night-rider", "trophy-vault"];
  return [];
}

export function OniMemberRouteFx() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { effectIds } = useMyCosmetics();
  const active = useMemo(() => {
    const equipped = new Set(effectIds);
    return requestedRouteFx(pathname).filter((id) => equipped.has(id));
  }, [effectIds, pathname]);

  if (!active.length) return null;

  return (
    <OniCosmeticFx
      effectIds={active}
      entranceKey={`${pathname}:${active.join("|")}`}
      className="oni-fx-route-overlay"
      ambient
    >
      <span aria-hidden="true" />
    </OniCosmeticFx>
  );
}
