import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { watchMemberAuth } from "@/data/member-auth";
import { firebaseDb } from "@/integrations/firebase/client";

function equippedIds(data: Record<string, unknown> | undefined): string[] {
  const equipped = data?.["equipped"];
  if (!equipped || typeof equipped !== "object") return [];
  return Object.values(equipped as Record<string, unknown>)
    .map(String)
    .filter(Boolean);
}

export function useMyCosmetics() {
  const [effectIds, setEffectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProgression: (() => void) | null = null;

    const clear = () => {
      unsubscribeProgression?.();
      unsubscribeProgression = null;
      setEffectIds([]);
      setLoading(false);
    };

    const unsubscribeAuth = watchMemberAuth(({ user, account }) => {
      unsubscribeProgression?.();
      unsubscribeProgression = null;

      if (!user || account?.status !== "approved") {
        setEffectIds([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeProgression = onSnapshot(
        doc(firebaseDb, "progressionProfiles", user.uid),
        (snapshot) => {
          setEffectIds(snapshot.exists() ? equippedIds(snapshot.data()) : []);
          setLoading(false);
        },
        clear,
      );
    }, clear);

    return () => {
      unsubscribeProgression?.();
      unsubscribeAuth();
    };
  }, []);

  return { effectIds, loading };
}
