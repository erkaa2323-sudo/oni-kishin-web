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
  updateDoc,
} from "firebase/firestore";

const projectId = "demo-oni-economy";
const rules = await fs.readFile("firestore.economy-audit.rules", "utf8");
const env = await initializeTestEnvironment({
  projectId,
  firestore: { host: "127.0.0.1", port: 8089, rules },
});

const now = Date.now();
const weekStart = Timestamp.fromMillis(now - 60 * 60 * 1000);
const weekEnd = Timestamp.fromMillis(now + 60 * 60 * 1000);
const meetStart = Timestamp.fromMillis(now - 10 * 60 * 1000);

const profile = (uid, overrides = {}) => ({
  uid,
  nickname: uid.toUpperCase(),
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
  ...overrides,
});

await env.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await setDoc(doc(db, "memberAccounts", "alice"), { status: "approved", nickname: "ALICE" });
  await setDoc(doc(db, "memberAccounts", "bob"), { status: "approved", nickname: "BOB" });
  await setDoc(doc(db, "progressionProfiles", "alice"), profile("alice"));
  await setDoc(doc(db, "progressionProfiles", "bob"), profile("bob", { xp: 26000, lifetimeXp: 28000, seasonXp: 9000, coin: 2200 }));
  await setDoc(doc(db, "progressionMissions", "currentWeek"), {
    weekId: "2026-W37",
    startsAt: weekStart,
    endsAt: weekEnd,
    enabled: true,
  });
  await setDoc(doc(db, "progressionWeekly", "alice"), {
    uid: "alice",
    weekId: "2026-W37",
    meet: 2,
    creator: 0,
    activity: 2,
    lastSourceType: "seed",
    lastSourceKey: "seed",
    updatedAt: Timestamp.fromMillis(now - 1000),
  });
  await setDoc(doc(db, "meets", "current"), {
    enabled: true,
    startAt: meetStart,
    status: "live",
    maxPlayers: 20,
  });
  await setDoc(doc(db, "meetParticipants", "alice"), {
    meetId: "current",
    meetStartAt: meetStart,
    nick: "ALICE",
    joinedAt: Timestamp.fromMillis(now - 20 * 60 * 1000),
  });
});

const alice = env.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
const bob = env.authenticatedContext("bob", { email: "bob@example.com" }).firestore();

console.log("CASE_1_ARBITRARY_MINT_BEGIN");
await assertFails(updateDoc(doc(alice, "progressionProfiles", "alice"), {
  coin: 999999,
  updatedAt: serverTimestamp(),
}));
console.log("CASE_1_ARBITRARY_MINT_END");

console.log("CASE_2_VAULT_VALID_BEGIN");
await assertSucceeds(runTransaction(alice, async (tx) => {
  const profileRef = doc(alice, "progressionProfiles", "alice");
  const spendRef = doc(alice, "progressionLedger", "spend_alice_frame-crimson");
  const snap = await tx.get(profileRef);
  const row = snap.data();
  tx.update(profileRef, {
    coin: Number(row.coin) - 700,
    unlocked: [...row.unlocked, "frame-crimson"],
    lastAction: { type: "vault_unlock", key: "frame-crimson" },
    updatedAt: serverTimestamp(),
  });
  tx.set(spendRef, {
    uid: "alice",
    sourceType: "vault_spend",
    sourceKey: "frame-crimson",
    itemId: "frame-crimson",
    xp: 0,
    coin: -700,
    balanceAfter: Number(row.coin) - 700,
    createdAt: serverTimestamp(),
  });
}));
console.log("CASE_2_VAULT_VALID_END");

const postVault = await assertSucceeds(getDoc(doc(alice, "progressionProfiles", "alice")));
if (postVault.data().coin !== 300 || !postVault.data().unlocked.includes("frame-crimson")) {
  throw new Error("Vault atomic spend invariant failed");
}

console.log("CASE_3_FAKE_LEDGER_BEGIN");
await assertFails(setDoc(doc(alice, "progressionLedger", "spend_alice_title-night-rider"), {
  uid: "alice",
  sourceType: "vault_spend",
  sourceKey: "title-night-rider",
  itemId: "title-night-rider",
  xp: 0,
  coin: -900,
  balanceAfter: 300,
  createdAt: serverTimestamp(),
}));
console.log("CASE_3_FAKE_LEDGER_END");

console.log("CASE_4_WEEKLY_VALID_BEGIN");
await assertSucceeds(runTransaction(alice, async (tx) => {
  const profileRef = doc(alice, "progressionProfiles", "alice");
  const claimRef = doc(alice, "progressionMissionClaims", "alice_2026-W37_meet-2");
  const ledgerRef = doc(alice, "progressionLedger", "mission_alice_2026-W37_meet-2");
  const snap = await tx.get(profileRef);
  const currentCoin = Number(snap.data().coin);
  tx.set(claimRef, {
    uid: "alice",
    weekId: "2026-W37",
    missionId: "meet-2",
    rewardCoin: 300,
    createdAt: serverTimestamp(),
  });
  tx.set(ledgerRef, {
    uid: "alice",
    sourceType: "weekly_mission",
    sourceKey: "2026-W37_meet-2",
    xp: 0,
    coin: 300,
    balanceAfter: currentCoin + 300,
    weekId: "2026-W37",
    missionId: "meet-2",
    createdAt: serverTimestamp(),
  });
  tx.update(profileRef, {
    coin: currentCoin + 300,
    lastAction: { type: "weekly_claim", key: "meet-2", weekId: "2026-W37" },
    updatedAt: serverTimestamp(),
  });
}));
console.log("CASE_4_WEEKLY_VALID_END");

console.log("CASE_4B_WEEKLY_REPLAY_BEGIN");
await assertFails(runTransaction(alice, async (tx) => {
  const profileRef = doc(alice, "progressionProfiles", "alice");
  const snap = await tx.get(profileRef);
  tx.update(profileRef, { coin: Number(snap.data().coin) + 300, updatedAt: serverTimestamp() });
}));
console.log("CASE_4B_WEEKLY_REPLAY_END");

const meetRewardTx = async (db, nonce) => runTransaction(db, async (tx) => {
  const profileRef = doc(db, "progressionProfiles", "alice");
  const claimRef = doc(db, "progressionMeetClaims", "alice");
  const ledgerRef = doc(db, "progressionLedger", `alice_${nonce}`);
  const snap = await tx.get(profileRef);
  const row = snap.data();
  const balanceAfter = Number(row.coin) + 50;
  tx.set(claimRef, { uid: "alice", meetStartAt: meetStart, claimNonce: nonce, updatedAt: serverTimestamp() });
  tx.set(ledgerRef, {
    uid: "alice",
    sourceType: "meet_attendance",
    sourceKey: nonce,
    xp: 100,
    coin: 50,
    balanceAfter,
    meetStartAt: meetStart,
    createdAt: serverTimestamp(),
  });
  tx.update(profileRef, {
    xp: Number(row.xp) + 100,
    coin: balanceAfter,
    lifetimeXp: Number(row.lifetimeXp) + 100,
    seasonXp: Number(row.seasonXp) + 100,
    meetCount: Number(row.meetCount) + 1,
    lastAction: { type: "meet_reward", key: nonce },
    updatedAt: serverTimestamp(),
  });
});

console.log("CASE_5_MEET_NO_ATTENDANCE_BEGIN");
await assertFails(meetRewardTx(alice, "noregattendance001"));
console.log("CASE_5_MEET_NO_ATTENDANCE_END");

await env.withSecurityRulesDisabled(async (context) => {
  await setDoc(doc(context.firestore(), "meetAttendance", "alice"), {
    uid: "alice",
    meetId: "current",
    meetStartAt: meetStart,
    confirmedAt: Timestamp.fromMillis(now),
    confirmedBy: "admin-seed",
  });
});
console.log("CASE_5B_MEET_CONFIRMED_BEGIN");
await assertSucceeds(meetRewardTx(alice, "confirmedattendance01"));
console.log("CASE_5B_MEET_CONFIRMED_END");

const aliceAfterMeet = await assertSucceeds(getDoc(doc(alice, "progressionProfiles", "alice")));
const aliceRow = aliceAfterMeet.data();
console.log("CASE_6_ACHIEVEMENT_VALID_BEGIN");
await assertSucceeds(setDoc(doc(alice, "progressionAchievementClaims", "alice_first-blood"), {
  uid: "alice",
  achievementId: "first-blood",
  meetCount: aliceRow.meetCount,
  creatorCount: aliceRow.creatorCount,
  unlockedCount: aliceRow.unlocked.length,
  lifetimeXp: aliceRow.lifetimeXp,
  claimedAt: serverTimestamp(),
}));
console.log("CASE_6_ACHIEVEMENT_VALID_END");

console.log("CASE_6B_ACHIEVEMENT_UNEARNED_BEGIN");
await assertFails(setDoc(doc(alice, "progressionAchievementClaims", "alice_legend"), {
  uid: "alice",
  achievementId: "legend",
  meetCount: aliceRow.meetCount,
  creatorCount: aliceRow.creatorCount,
  unlockedCount: aliceRow.unlocked.length,
  lifetimeXp: aliceRow.lifetimeXp,
  claimedAt: serverTimestamp(),
}));
console.log("CASE_6B_ACHIEVEMENT_UNEARNED_END");

console.log("CASE_7_PRESTIGE_VALID_BEGIN");
await assertSucceeds(runTransaction(bob, async (tx) => {
  const profileRef = doc(bob, "progressionProfiles", "bob");
  const claimRef = doc(bob, "progressionPrestigeClaims", "bob_1");
  const ledgerRef = doc(bob, "progressionLedger", "prestige_bob_1");
  const snap = await tx.get(profileRef);
  const row = snap.data();
  tx.set(claimRef, {
    uid: "bob",
    prestige: 1,
    previousXp: row.xp,
    lifetimeXp: row.lifetimeXp,
    createdAt: serverTimestamp(),
  });
  tx.set(ledgerRef, {
    uid: "bob",
    sourceType: "prestige",
    sourceKey: "1",
    xp: 0,
    coin: 0,
    balanceAfter: row.coin,
    prestige: 1,
    createdAt: serverTimestamp(),
  });
  tx.update(profileRef, {
    xp: 0,
    prestige: 1,
    lastAction: { type: "prestige", key: "1" },
    updatedAt: serverTimestamp(),
  });
}));
console.log("CASE_7_PRESTIGE_VALID_END");

const bobAfter = await assertSucceeds(getDoc(doc(bob, "progressionProfiles", "bob")));
if (bobAfter.data().prestige !== 1 || bobAfter.data().xp !== 0 || bobAfter.data().coin !== 2200 || bobAfter.data().lifetimeXp !== 28000 || bobAfter.data().seasonXp !== 9000) {
  throw new Error("Prestige preservation invariant failed");
}

console.log("ECONOMY_SECURITY_INTEGRATION_OK");
await env.cleanup();