import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const projectId = "demo-oni-economy";
const rules = await fs.readFile("firestore.economy-audit.rules", "utf8");
const env = await initializeTestEnvironment({
  projectId,
  firestore: { host: "127.0.0.1", port: 8089, rules },
});

const uid = "shop-v2-alice";
const now = Date.now();

await env.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await setDoc(doc(db, "memberAccounts", uid), {
    status: "approved",
    nickname: "SHOP V2 ALICE",
  });
  await setDoc(doc(db, "progressionProfiles", uid), {
    uid,
    nickname: "SHOP V2 ALICE",
    xp: 6000,
    coin: 12000,
    lifetimeXp: 6000,
    seasonXp: 6000,
    prestige: 0,
    meetCount: 4,
    creatorCount: 2,
    eventCount: 1,
    unlocked: [],
    equipped: {},
    createdAt: Timestamp.fromMillis(now - 1000),
    updatedAt: Timestamp.fromMillis(now - 1000),
  });
});

const db = env.authenticatedContext(uid, { email: "shop-v2@example.com" }).firestore();
const guestDb = env.unauthenticatedContext().firestore();
const orderId = "premiumorder0001";
const serviceId = "premium-30-day";
const price = 10000;
const balanceAfter = 2000;
const profileRef = doc(db, "progressionProfiles", uid);
const ledgerRef = doc(db, "progressionLedger", `service_${orderId}`);
const orderRef = doc(db, "shopOrders", orderId);
const feedRef = doc(db, "shopPurchaseFeed", orderId);

console.log("CASE_SHOP_V2_PREMIUM_PURCHASE_BEGIN");
await assertSucceeds(
  runTransaction(db, async (tx) => {
    const profileSnap = await tx.get(profileRef);
    assert.equal(profileSnap.data().coin, 12000);
    tx.update(profileRef, {
      coin: balanceAfter,
      lastAction: { type: "cpm_service_purchase", key: orderId, serviceId },
      updatedAt: serverTimestamp(),
    });
    tx.set(ledgerRef, {
      uid,
      sourceType: "cpm_service_purchase",
      sourceKey: orderId,
      serviceId,
      xp: 0,
      coin: 0 - price,
      balanceAfter,
      createdAt: serverTimestamp(),
    });
    tx.set(orderRef, {
      uid,
      nickname: "SHOP V2 ALICE",
      serviceId,
      price,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(feedRef, {
      nickname: "SHOP V2 ALICE",
      serviceId,
      price,
      status: "purchased",
      createdAt: serverTimestamp(),
    });
  }),
);
console.log("CASE_SHOP_V2_PREMIUM_PURCHASE_END");

const [profileSnap, ledgerSnap, orderSnap, publicFeedSnap] = await Promise.all([
  assertSucceeds(getDoc(profileRef)),
  assertSucceeds(getDoc(ledgerRef)),
  assertSucceeds(getDoc(orderRef)),
  assertSucceeds(getDoc(doc(guestDb, "shopPurchaseFeed", orderId))),
]);
assert.equal(profileSnap.data().coin, 2000);
assert.equal(ledgerSnap.data().coin, -10000);
assert.equal(orderSnap.data().status, "pending");
assert.equal(publicFeedSnap.data().serviceId, "premium-30-day");
assert.equal(Object.hasOwn(publicFeedSnap.data(), "uid"), false);

console.log("CASE_SHOP_V2_PRIVATE_ORDER_GUEST_DENIED_BEGIN");
await assertFails(getDoc(doc(guestDb, "shopOrders", orderId)));
console.log("CASE_SHOP_V2_PRIVATE_ORDER_GUEST_DENIED_END");

console.log("CASE_SHOP_V2_FORGED_PRICE_DENIED_BEGIN");
const forgedOrderId = "forgedmoney0001";
await assertFails(
  runTransaction(db, async (tx) => {
    const snap = await tx.get(profileRef);
    const forgedPrice = 1400;
    const forgedBalance = Number(snap.data().coin) - forgedPrice;
    tx.update(profileRef, {
      coin: forgedBalance,
      lastAction: { type: "cpm_service_purchase", key: forgedOrderId, serviceId: "money" },
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(db, "progressionLedger", `service_${forgedOrderId}`), {
      uid,
      sourceType: "cpm_service_purchase",
      sourceKey: forgedOrderId,
      serviceId: "money",
      xp: 0,
      coin: 0 - forgedPrice,
      balanceAfter: forgedBalance,
      createdAt: serverTimestamp(),
    });
    tx.set(doc(db, "shopOrders", forgedOrderId), {
      uid,
      nickname: "SHOP V2 ALICE",
      serviceId: "money",
      price: forgedPrice,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(db, "shopPurchaseFeed", forgedOrderId), {
      nickname: "SHOP V2 ALICE",
      serviceId: "money",
      price: forgedPrice,
      status: "purchased",
      createdAt: serverTimestamp(),
    });
  }),
);
console.log("CASE_SHOP_V2_FORGED_PRICE_DENIED_END");

console.log("CASE_SHOP_V2_GUEST_FEED_WRITE_DENIED_BEGIN");
await assertFails(
  setDoc(doc(guestDb, "shopPurchaseFeed", "guestfake"), {
    nickname: "FAKE",
    serviceId: "name-color",
    price: 2500,
    status: "purchased",
    createdAt: serverTimestamp(),
  }),
);
console.log("CASE_SHOP_V2_GUEST_FEED_WRITE_DENIED_END");

const afterForged = await assertSucceeds(getDoc(profileRef));
assert.equal(afterForged.data().coin, 2000);

console.log("SHOP_V2_RULES_OK");
await env.cleanup();
