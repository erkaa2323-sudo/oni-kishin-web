import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";
import { ONI_REWARDS } from "@/lib/progression-rewards";

export type CreatorPublishStatus = "pending" | "approved" | "rejected";
export type CreatorPublishPreset = "profile" | "garage" | "instagram" | "meet" | "crew";

export type CreatorPublishRequest = {
  id: string;
  uid: string;
  nickname: string;
  cpmId: string;
  preset: CreatorPublishPreset;
  title: string;
  image: string;
  status: CreatorPublishStatus;
  createdAt: string;
  reviewedAt: string;
};

const asIso = (value: unknown) => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === "object" && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return "";
    }
  }
  return typeof value === "string" ? value : "";
};

const fromDoc = (id: string, row: Record<string, unknown>): CreatorPublishRequest => ({
  id,
  uid: String(row["uid"] ?? ""),
  nickname: String(row["nickname"] ?? ""),
  cpmId: String(row["cpmId"] ?? ""),
  preset: ["profile", "garage", "instagram", "meet", "crew"].includes(String(row["preset"]))
    ? (String(row["preset"]) as CreatorPublishPreset)
    : "profile",
  title: String(row["title"] ?? "ONI CREATOR"),
  image: String(row["image"] ?? ""),
  status: row["status"] === "approved" || row["status"] === "rejected" ? row["status"] : "pending",
  createdAt: asIso(row["createdAt"]),
  reviewedAt: asIso(row["reviewedAt"]),
});

export async function submitCreatorPublishRequest(input: {
  nickname: string;
  cpmId: string;
  preset: CreatorPublishPreset;
  title: string;
  image: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const user = firebaseAuth.currentUser;
  if (!user)
    return { ok: false, message: "Gallery-д илгээхийн тулд member account-аараа нэвтэрнэ үү." };
  if (!input.image.startsWith("data:image/jpeg;base64,") || input.image.length > 900_000)
    return {
      ok: false,
      message: "Gallery asset хэт том байна. Дахин generate хийгээд оролдоно уу.",
    };

  const accountSnap = await getDoc(doc(firebaseDb, "memberAccounts", user.uid));
  if (!accountSnap.exists() || accountSnap.data()["status"] !== "approved")
    return { ok: false, message: "Gallery publish нь зөвшөөрөгдсөн ONI member-д нээлттэй." };

  const ref = doc(collection(firebaseDb, "creatorPublishRequests"));
  await setDoc(ref, {
    uid: user.uid,
    nickname:
      input.nickname.trim().slice(0, 60) || String(accountSnap.data()["nickname"] ?? "ONI MEMBER"),
    cpmId: input.cpmId.trim().slice(0, 60) || String(accountSnap.data()["cpmId"] ?? ""),
    preset: input.preset,
    title: input.title.trim().slice(0, 100) || "ONI CREATOR",
    image: input.image,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return { ok: true, id: ref.id };
}

export async function listCreatorPublishRequests(
  status?: CreatorPublishStatus,
): Promise<CreatorPublishRequest[]> {
  const q = status
    ? query(collection(firebaseDb, "creatorPublishRequests"), where("status", "==", status))
    : query(collection(firebaseDb, "creatorPublishRequests"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((entry) => fromDoc(entry.id, entry.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function reviewCreatorPublishRequest(id: string, decision: "approved" | "rejected") {
  const requestRef = doc(firebaseDb, "creatorPublishRequests", id);
  return runTransaction(firebaseDb, async (tx) => {
    const snapshot = await tx.get(requestRef);
    if (!snapshot.exists()) throw new Error("Publish request олдсонгүй.");
    const row = fromDoc(snapshot.id, snapshot.data());
    if (row.status !== "pending") throw new Error("Энэ хүсэлт аль хэдийн шийдэгдсэн байна.");

    if (decision === "approved") {
      const galleryRef = doc(collection(firebaseDb, "gallery"));
      tx.set(galleryRef, {
        title: row.title,
        owner: row.nickname || "Oni And Kishin",
        category: row.preset === "garage" ? "clean" : row.preset === "meet" ? "drift" : "anime",
        build: `SHIZUKI CREATOR · ${row.preset.toUpperCase()}${row.cpmId ? ` · CPM ${row.cpmId}` : ""}`,
        image: row.image,
        createdAt: Timestamp.now(),
      });

      if (row.uid) {
        const reward = ONI_REWARDS.creatorApproved;
        const profileRef = doc(firebaseDb, "progressionProfiles", row.uid);
        const ledgerRef = doc(firebaseDb, "progressionLedger", `creator_${row.uid}_${row.id}`);
        const socialRef = doc(firebaseDb, "socialEvents", `creator_${row.uid}_${row.id}`);
        const [profileSnap, ledgerSnap] = await Promise.all([
          tx.get(profileRef),
          tx.get(ledgerRef),
        ]);
        if (!ledgerSnap.exists()) {
          tx.set(ledgerRef, {
            uid: row.uid,
            sourceType: "creator_approved",
            sourceKey: row.id,
            xp: reward.xp,
            coin: reward.coin,
            createdAt: Timestamp.now(),
          });
          if (profileSnap.exists()) {
            const p = profileSnap.data();
            tx.update(profileRef, {
              xp: Number(p["xp"] ?? 0) + reward.xp,
              coin: Number(p["coin"] ?? 0) + reward.coin,
              lifetimeXp: Number(p["lifetimeXp"] ?? p["xp"] ?? 0) + reward.xp,
              seasonXp: Number(p["seasonXp"] ?? p["xp"] ?? 0) + reward.xp,
              creatorCount: Number(p["creatorCount"] ?? 0) + 1,
              updatedAt: Timestamp.now(),
            });
          } else {
            tx.set(profileRef, {
              uid: row.uid,
              nickname: row.nickname || "ONI MEMBER",
              xp: reward.xp,
              coin: reward.coin,
              lifetimeXp: reward.xp,
              seasonXp: reward.xp,
              prestige: 0,
              meetCount: 0,
              creatorCount: 1,
              eventCount: 0,
              unlocked: [],
              equipped: {},
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });
          }
          tx.set(socialRef, {
            uid: row.uid,
            nickname: row.nickname || "ONI MEMBER",
            type: "creator_approved",
            title: `${row.nickname || "ONI MEMBER"} шинэ content батлууллаа`,
            detail: `${row.title} · +${reward.xp} XP · +${reward.coin} ONI`,
            targetUrl: "/gallery",
            reactions: 0,
            createdAt: Timestamp.now(),
          });
        }
      }
    }

    tx.update(requestRef, {
      status: decision,
      reviewedAt: Timestamp.now(),
      reviewedBy: firebaseAuth.currentUser?.uid ?? "",
    });
  });
}
