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

const uid = "shop-social-alice";
const now = Date.now();

await env.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await setDoc(doc(db, "memberAccounts", uid), {
    status: "approved",
    nickname: "SHOP ALICE",
  });
  await setDoc(doc(db, "progressionProfiles", uid), {
    uid,
    nickname: "SHOP ALICE",
    xp: 1000,
    coin: 1000,
    lifetimeXp: 1000,
    seasonXp: 1000,
    prestige: 0,
    meetCount: 0,
    creatorCount: 0,
    eventCount: 0,
    unlocked: [],
    equipped: {},
    createdAt: Timestamp.fromMillis(now - 1000),
    updatedAt: Timestamp.fromMillis(now - 1000),
  });
});

const db = env.authenticatedContext(uid, { email: "shop@example.com" }).firestore();
const profileRef = doc(db, "progressionProfiles", uid);
const spendRef = doc(db, "progressionLedger", `spend_${uid}_frame-crimson`);
const socialRef = doc(db, "socialEvents", `${uid}_cosmetic_frame-crimson`);

console.log("CASE_SHOP_SOCIAL_ORPHAN_DENIED_BEGIN");
await assertFails(
  setDoc(socialRef, {
    uid,
    nickname: "SHOP ALICE",
    type: "cosmetic_unlock",
    itemId: "frame-crimson",
    title: "SHOP ALICE шинэ cosmetic unlock хийлээ",
    detail: "CRIMSON ONI FRAME · rare",
    targetUrl: "/progression",
    reactions: 0,
    createdAt: serverTimestamp(),
  }),
);
console.log("CASE_SHOP_SOCIAL_ORPHAN_DENIED_END");

console.log("CASE_SHOP_PRODUCTION_UNLOCK_TX_BEGIN");
await assertSucceeds(
  runTransaction(db, async (tx) => {
    const snap = await tx.get(profileRef);
    const row = snap.data();
    const balanceAfter = Number(row.coin) - 700;

    tx.update(profileRef, {
      coin: balanceAfter,
      unlocked: [...row.unlocked, "frame-crimson"],
      lastAction: { type: "vault_unlock", key: "frame-crimson" },
      updatedAt: serverTimestamp(),
    });
    tx.set(spendRef, {
      uid,
      sourceType: "vault_spend",
      sourceKey: "frame-crimson",
      itemId: "frame-crimson",
      xp: 0,
      coin: -700,
      balanceAfter,
      createdAt: serverTimestamp(),
    });
    tx.set(socialRef, {
      uid,
      nickname: "SHOP ALICE",
      type: "cosmetic_unlock",
      itemId: "frame-crimson",
      title: "SHOP ALICE шинэ cosmetic unlock хийлээ",
      detail: "CRIMSON ONI FRAME · rare",
      targetUrl: "/progression",
      reactions: 0,
      createdAt: serverTimestamp(),
    });
  }),
);
console.log("CASE_SHOP_PRODUCTION_UNLOCK_TX_END");

const [profileSnap, spendSnap, socialSnap] = await Promise.all([
  assertSucceeds(getDoc(profileRef)),
  assertSucceeds(getDoc(spendRef)),
  assertSucceeds(getDoc(socialRef)),
]);

assert.equal(profileSnap.data().coin, 300);
assert.equal(profileSnap.data().unlocked.includes("frame-crimson"), true);
assert.equal(spendSnap.data().coin, -700);
assert.equal(socialSnap.data().itemId, "frame-crimson");

console.log("SHOP_COSMETIC_UNLOCK_SOCIAL_TX_OK");
await env.cleanup();
