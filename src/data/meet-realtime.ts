import { collection, doc, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";

import { MEET_REGISTRATION_GRACE_MS, type MeetParticipant, type MeetSession } from "@/data/meet";
import { firebaseDb } from "@/integrations/firebase/client";

function dateValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value && typeof value === "object" && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export function subscribeActiveMeet(
  onChange: (session: MeetSession | null) => void,
  onError?: (reason: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firebaseDb, "meets", "current"),
    (snapshot) => {
      if (!snapshot.exists() || snapshot.data()["enabled"] !== true) {
        onChange(null);
        return;
      }
      const row = snapshot.data();
      const scheduledAt = dateValue(row["startAt"]);
      const explicitClose = dateValue(row["registrationClosesAt"]);
      const registrationClosesAt =
        explicitClose ??
        (scheduledAt
          ? new Date(new Date(scheduledAt).getTime() + MEET_REGISTRATION_GRACE_MS).toISOString()
          : null);
      onChange({
        id: "current",
        title: String(row["title"] || row["name"] || "ONI MEET"),
        scheduledAt,
        endsAt: dateValue(row["endsAt"]),
        registrationClosesAt,
        capacity: typeof row["maxPlayers"] === "number" ? row["maxPlayers"] : 20,
        registered: 0,
        status: row["status"] === "live" ? "live" : "scheduled",
      });
    },
    () => onError?.("Meet мэдээллийн realtime холболт тасарлаа."),
  );
}

export function subscribeMeetParticipants(
  meetId: string,
  onChange: (participants: MeetParticipant[]) => void,
  onError?: () => void,
): Unsubscribe {
  if (meetId !== "current") {
    onChange([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(firebaseDb, "meetRoster"), where("meetId", "==", meetId)),
    (snapshot) => {
      const participants = snapshot.docs
        .filter((entry) => entry.id !== "__counter__")
        .map((entry) => {
          const row = entry.data();
          const joined = row["joinedAt"];
          return {
            cpmNickname: String(row["nickname"] || row["nick"] || row["name"] || "ONI MEMBER"),
            registeredAt:
              joined && typeof joined.toDate === "function"
                ? joined.toDate().toISOString()
                : new Date().toISOString(),
          };
        })
        .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
      onChange(participants);
    },
    () => {
      onError?.();
    },
  );
}
