import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/integrations/firebase/client";
import { parseProgressionProfile } from "@/data/progression";
import { CPM_SERVICE_BY_ID, type CpmService } from "@/lib/oni-shop";

export type PublicShopPurchase = {
  id: string;
  nickname: string;
  serviceId: string;
  serviceName: string;
  price: number;
  createdAt: string | null;
};

const toIso = (value: unknown) =>
  value && typeof value === "object" && "toDate" in value
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : null;

export async function purchaseCpmService(serviceId: string): Promise<{
  orderId: string;
  service: CpmService;
  balanceAfter: number;
}> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("auth_required");
  const service = CPM_SERVICE_BY_ID.get(serviceId);
  if (!service) throw new Error("service_not_found");

  const orderId = crypto.randomUUID().replaceAll("-", "");
  const profileRef = doc(firebaseDb, "progressionProfiles", user.uid);
  const ledgerRef = doc(firebaseDb, "progressionLedger", `service_${orderId}`);
  const orderRef = doc(firebaseDb, "shopOrders", orderId);
  const feedRef = doc(firebaseDb, "shopPurchaseFeed", orderId);

  const balanceAfter = await runTransaction(firebaseDb, async (tx) => {
    const profileSnap = await tx.get(profileRef);
    if (!profileSnap.exists()) throw new Error("profile_required");
    const profile = parseProgressionProfile(user.uid, profileSnap.data());
    if (profile.coin < service.price) throw new Error("coin_required");
    const nextBalance = profile.coin - service.price;

    tx.update(profileRef, {
      coin: nextBalance,
      lastAction: {
        type: "cpm_service_purchase",
        key: orderId,
        serviceId: service.id,
      },
      updatedAt: serverTimestamp(),
    });

    tx.set(ledgerRef, {
      uid: user.uid,
      sourceType: "cpm_service_purchase",
      sourceKey: orderId,
      serviceId: service.id,
      serviceName: service.name,
      xp: 0,
      coin: 0 - service.price,
      balanceAfter: nextBalance,
      createdAt: serverTimestamp(),
    });

    tx.set(orderRef, {
      uid: user.uid,
      nickname: profile.nickname,
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(feedRef, {
      nickname: profile.nickname,
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      status: "purchased",
      createdAt: serverTimestamp(),
    });

    return nextBalance;
  });

  return { orderId, service, balanceAfter };
}

export async function getPublicShopPurchaseFeed(maxRows = 30): Promise<PublicShopPurchase[]> {
  const snapshot = await getDocs(
    query(collection(firebaseDb, "shopPurchaseFeed"), orderBy("createdAt", "desc"), limit(maxRows)),
  );
  return snapshot.docs.map((entry) => {
    const row = entry.data();
    return {
      id: entry.id,
      nickname: String(row["nickname"] ?? "ONI MEMBER"),
      serviceId: String(row["serviceId"] ?? ""),
      serviceName: String(row["serviceName"] ?? "CPM SERVICE"),
      price: Math.max(0, Number(row["price"] ?? 0)),
      createdAt: toIso(row["createdAt"]),
    };
  });
}
