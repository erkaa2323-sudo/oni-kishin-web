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
const legacyUid = "shop-legacy-bob";
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

  await setDoc(doc(db, "memberAccounts", legacyUid), {
    status: "approved",
    nickname: "LEGACY BOB",
  });
  await setDoc(doc(db, "progressionProfiles", legacyUid), {
    uid: legacyUid,
    nickname: "LEGACY BOB",
    xp: 1000,
    coin: 1000,
    unlocked: [],
    equipped: {},
    createdAt: Timestamp.fromMillis(now - 1000),
    updatedAt: Timestamp.fromMillis(now - 1000),
  });
});

async function runProductionUnlock(db, memberUid, nickname) {
  const profileRef = doc(db, "progressionProfiles", memberUid);
  const spendRef = doc(db, "progressionLedger", `spend_${memberUid}_frame-crimson`);
  const socialRef = doc(db, "socialEvents", `${memberUid}_cosmetic_frame-crimson`);

  // A first-time purchase has no spend ledger yet. Production rules intentionally
  // deny reading that missing document, so the client must not pre-read it.
  await assertFails(getDoc(spendRef));

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
        uid: memberUid,
        sourceType: "vault_spend",
        sourceKey: "frame-crimson",
        itemId: "frame-crimson",
        xp: 0,
        coin: -700,
        balanceAfter,
        createdAt: serverTimestamp(),
      });
      tx.set(socialRef, {
        uid: memberUid,
        nickname,
        type: "cosmetic_unlock",
        itemId: "frame-crimson",
        title: `${nickname} шинэ cosmetic unlock хийлээ`,
        detail: "CRIMSON ONI FRAME · rare",
        targetUrl: "/progression",
        reactions: 0,
        createdAt: serverTimestamp(),
      });
    }),
  );

  const [profileSnap, spendSnap, socialSnap] = await Promise.all([
    assertSucceeds(getDoc(profileRef)),
    assertSucceeds(getDoc(spendRef)),
    assertSucceeds(getDoc(socialRef)),
  ]);

  assert.equal(profileSnap.data().coin, 300);
  assert.equal(profileSnap.data().unlocked.includes("frame-crimson"), true);
  assert.equal(spendSnap.data().coin, -700);
  assert.equal(socialSnap.data().itemId, "frame-crimson");
}

const db = env.authenticatedContext(uid, { email: "shop@example.com" }).firestore();
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
await runProductionUnlock(db, uid, "SHOP ALICE");
console.log("CASE_SHOP_PRODUCTION_UNLOCK_TX_END");

const legacyDb = env
  .authenticatedContext(legacyUid, { email: "legacy-shop@example.com" })
  .firestore();
console.log("CASE_SHOP_LEGACY_PROFILE_UNLOCK_TX_BEGIN");
await runProductionUnlock(legacyDb, legacyUid, "LEGACY BOB");
console.log("CASE_SHOP_LEGACY_PROFILE_UNLOCK_TX_END");

console.log("SHOP_COSMETIC_UNLOCK_SOCIAL_TX_OK");
await env.cleanup();
