import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { Timestamp, doc, setDoc, writeBatch } from "firebase/firestore";

let env;
const meetStart = Timestamp.fromMillis(Date.now() - 60 * 1000);
const meetStartAt = meetStart;
const previousMeetStart = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);

async function seedCurrentMeet(startAt = meetStart) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "meets", "current"), {
      title: "NEXT MEET",
      enabled: true,
      status: "scheduled",
      startAt,
      registrationClosesAt: Timestamp.fromMillis(startAt.toMillis() + 30 * 60 * 1000),
      maxPlayers: 20,
      createdAt: Timestamp.now(),
    });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-oni-hardening",
    firestore: {
      host: "127.0.0.1",
      port: 8088,
      rules: readFileSync("firestore.test.generated.rules", "utf8"),
    },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "products", "real-product"), {
      name: "Change Gmail",
      price: 6000,
    });
    await setDoc(doc(db, "products", "invalid-product"), {
      name: "Invalid",
      price: "6000",
    });
    await setDoc(doc(db, "members", "member-alice"), {
      nick: "ALICE",
      cpmid: "ALICE01",
      status: "active",
    });
    await setDoc(doc(db, "memberAccounts", "alice"), {
      email: "alice@example.com",
      memberId: "member-alice",
      nickname: "ALICE",
      cpmId: "ALICE01",
      status: "approved",
    });
  });
  await seedCurrentMeet();
});
after(async () => {
  await env?.cleanup();
});
const order = {
  orderNo: "TEST-1",
  productId: "real-product",
  productName: "Change Gmail",
  unitPrice: 6000,
  quantity: 2,
  total: 12000,
  cpmNick: "Test",
  cpmId: "TEST",
  status: "Шинэ",
};
test("public order with authoritative price/name/total succeeds", async () => {
  await assertSucceeds(
    setDoc(doc(env.unauthenticatedContext().firestore(), "orders", "valid"), order),
  );
});
for (const [name, changes] of Object.entries({
  missingProduct: { productId: "missing" },
  cheapPrice: { unitPrice: 1, total: 2 },
  wrongName: { productName: "Forged" },
  wrongTotal: { total: 6000 },
  fractional: { quantity: 1.5, total: 9000 },
  zero: { quantity: 0, total: 0 },
  excessive: { quantity: 100, total: 600000 },
  negative: { unitPrice: -1, total: -2 },
  extraField: { admin: true },
  malformedProduct: { productId: "invalid-product", productName: "Invalid" },
}))
  test(`rejects ${name}`, async () => {
    await assertFails(
      setDoc(doc(env.unauthenticatedContext().firestore(), "orders", name), {
        ...order,
        ...changes,
      }),
    );
  });
test("only canonical owner can mutate products", async () => {
  const data = { name: "Other", price: 100 };
  for (const context of [
    env.unauthenticatedContext(),
    env.authenticatedContext("member", { email: "member@example.com", role: "admin" }),
  ]) {
    await assertFails(setDoc(doc(context.firestore(), "products", "new"), data));
  }
  await assertSucceeds(
    setDoc(
      doc(
        env.authenticatedContext("owner", { email: "erkaa130@gmail.com" }).firestore(),
        "products",
        "new",
      ),
      data,
    ),
  );
});
test("valid public Join still succeeds", async () => {
  await assertSucceeds(
    setDoc(doc(env.unauthenticatedContext().firestore(), "applications", "join"), {
      last: "Test",
      first: "Test",
      age: 20,
      gender: "Эрэгтэй",
      cpmid: "TEST",
      nick: "Test",
      direction: "Anime Car",
      contactType: "Instagram",
      contact: "test",
      experience: "1 – 2 жил",
      message: "",
      status: "Шинэ",
    }),
  );
});

test("approved member cannot register before Meet start", async () => {
  const futureStart = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
  await seedCurrentMeet(futureStart);
  const db = env.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, "meetParticipants", "alice"), {
    meetId: "current",
    meetStartAt: futureStart,
    memberId: "member-alice",
    nick: "ALICE",
    name: "ALICE",
    cpmId: "ALICE01",
    joinedAt: Timestamp.now(),
    source: "website",
    slotId: "current_01",
  });
  batch.set(doc(db, "meetSlots", "current_01"), {
    meetId: "current",
    meetStartAt: futureStart,
    participantId: "alice",
    memberId: "member-alice",
    createdAt: Timestamp.now(),
  });
  batch.set(doc(db, "meetRoster", "alice"), {
    meetId: "current",
    meetStartAt: futureStart,
    nickname: "ALICE",
    joinedAt: Timestamp.now(),
  });
  await assertFails(batch.commit());
  await seedCurrentMeet();
});

test("approved member can register all current Meet records atomically", async () => {
  const db = env.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, "meetParticipants", "alice"), {
    meetId: "current",
    meetStartAt,
    memberId: "member-alice",
    nick: "ALICE",
    name: "ALICE",
    cpmId: "ALICE01",
    joinedAt: Timestamp.now(),
    source: "website",
    slotId: "current_01",
  });
  batch.set(doc(db, "meetSlots", "current_01"), {
    meetId: "current",
    meetStartAt,
    participantId: "alice",
    memberId: "member-alice",
    createdAt: Timestamp.now(),
  });
  batch.set(doc(db, "meetRoster", "alice"), {
    meetId: "current",
    meetStartAt,
    nickname: "ALICE",
    joinedAt: Timestamp.now(),
  });
  await assertSucceeds(batch.commit());
});

test("stale previous Meet records can be replaced but current records cannot be rewritten", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "meetParticipants", "alice"), {
      meetId: "current",
      meetStartAt: previousMeetStart,
      memberId: "member-alice",
      nick: "ALICE",
      name: "ALICE",
      cpmId: "ALICE01",
      joinedAt: previousMeetStart,
      source: "website",
      slotId: "current_01",
    });
    await setDoc(doc(db, "meetSlots", "current_01"), {
      meetId: "current",
      meetStartAt: previousMeetStart,
      participantId: "alice",
      memberId: "member-alice",
      createdAt: previousMeetStart,
    });
    await setDoc(doc(db, "meetRoster", "alice"), {
      meetId: "current",
      meetStartAt: previousMeetStart,
      nickname: "ALICE",
      joinedAt: previousMeetStart,
    });
  });

  const db = env.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
  const replace = writeBatch(db);
  replace.set(doc(db, "meetParticipants", "alice"), {
    meetId: "current",
    meetStartAt,
    memberId: "member-alice",
    nick: "ALICE",
    name: "ALICE",
    cpmId: "ALICE01",
    joinedAt: Timestamp.now(),
    source: "website",
    slotId: "current_01",
  });
  replace.set(doc(db, "meetSlots", "current_01"), {
    meetId: "current",
    meetStartAt,
    participantId: "alice",
    memberId: "member-alice",
    createdAt: Timestamp.now(),
  });
  replace.set(doc(db, "meetRoster", "alice"), {
    meetId: "current",
    meetStartAt,
    nickname: "ALICE",
    joinedAt: Timestamp.now(),
  });
  await assertSucceeds(replace.commit());

  const rewrite = writeBatch(db);
  rewrite.set(doc(db, "meetParticipants", "alice"), {
    meetId: "current",
    meetStartAt,
    memberId: "member-alice",
    nick: "ALICE",
    name: "ALICE",
    cpmId: "ALICE01",
    joinedAt: Timestamp.now(),
    source: "website",
    slotId: "current_01",
  });
  rewrite.set(doc(db, "meetSlots", "current_01"), {
    meetId: "current",
    meetStartAt,
    participantId: "alice",
    memberId: "member-alice",
    createdAt: Timestamp.now(),
  });
  rewrite.set(doc(db, "meetRoster", "alice"), {
    meetId: "current",
    meetStartAt,
    nickname: "ALICE",
    joinedAt: Timestamp.now(),
  });
  await assertFails(rewrite.commit());
});

test("Meet credentials and voice enforce registration, session binding and server expiry", async () => {
  const { getDocFromServer, getDocs, collection, updateDoc } = await import("firebase/firestore");
  const guest = env.unauthenticatedContext().firestore();
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const admin = env.authenticatedContext("owner", { admin: true }).firestore();
  const start = Timestamp.fromMillis(Date.now() - 60_000);
  const secret = {
    roomId: "test-room-secret",
    password: "test-password-secret",
    meetStartAt: start,
    updatedAt: Timestamp.now(),
  };
  const fixture = async (changes = {}, participantChanges = {}, credentialChanges = {}) => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "meets", "current"), {
        enabled: true,
        status: "live",
        title: "Private Meet",
        startAt: start,
        createdAt: Timestamp.fromMillis(start.toMillis() - 1000),
        maxPlayers: 20,
        ...changes,
      });
      await setDoc(doc(db, "meetCredentials", "current"), { ...secret, ...credentialChanges });
      await setDoc(doc(db, "memberAccounts", "bob"), {
        status: "approved",
        memberId: "member-bob",
      });
      await setDoc(doc(db, "meetParticipants", "alice"), {
        meetId: "current",
        memberId: "member-alice",
        meetStartAt: start,
        slotId: "current_01",
        ...participantChanges,
      });
      await setDoc(doc(db, "meetSlots", "current_01"), {
        participantId: "alice",
        meetStartAt: start,
      });
    });
  };
  const credentials = (db) => getDocFromServer(doc(db, "meetCredentials", "current"));
  const voice = (db) => getDocFromServer(doc(db, "meetVoiceAuthorization", "current"));
  await fixture();
  for (const db of [guest, bob]) {
    await assertFails(credentials(db));
    await assertFails(voice(db));
  }
  await assertSucceeds(getDocFromServer(doc(guest, "meets", "current")));
  await assertSucceeds(credentials(alice));
  const virtual = await assertSucceeds(voice(alice));
  if (virtual.exists()) throw new Error("Voice authorization must have no stored data");
  await assertFails(voice(admin)); // Admin must also register for voice.
  await assertFails(getDocs(collection(alice, "meetCredentials")));
  await assertFails(setDoc(doc(bob, "meetVoiceAuthorization", "current"), { allowed: true }));
  await assertFails(setDoc(doc(bob, "meetCredentials", "current"), secret));
  for (const changes of [
    { startAt: Timestamp.fromMillis(Date.now() - 21 * 60_000) },
    { endsAt: Timestamp.fromMillis(Date.now() - 1000) },
    { endsAt: "invalid" },
    { status: "ended" },
    { status: "closed" },
    { enabled: false },
    { startAt: Timestamp.fromMillis(Date.now() + 60_000) },
  ]) {
    await fixture(
      changes,
      { meetStartAt: changes.startAt || start },
      { meetStartAt: changes.startAt || start },
    );
    if (changes.startAt)
      await env.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), "meetSlots", "current_01"), {
          meetStartAt: changes.startAt,
        });
      });
    await assertFails(credentials(alice));
    await assertFails(voice(alice));
    await assertSucceeds(credentials(admin));
  }
  await fixture({}, { meetStartAt: previousMeetStart });
  await assertFails(credentials(alice));
  await assertFails(voice(alice));
  await fixture({}, {}, { meetStartAt: previousMeetStart });
  await assertFails(credentials(alice));
  await fixture({}, {}, { updatedAt: previousMeetStart });
  await assertFails(credentials(alice));
  await fixture();
  await assertSucceeds(
    updateDoc(doc(admin, "meetCredentials", "current"), { password: "admin-edited" }),
  );
  await assertSucceeds(updateDoc(doc(admin, "meets", "current"), { title: "Admin can manage" }));
  await assertFails(updateDoc(doc(admin, "meets", "current"), { password: "must-be-private" }));
  await fixture({ roomId: "legacy-secret", password: "legacy-password" });
  await assertFails(getDocFromServer(doc(guest, "meets", "current")));
  await assertFails(getDocFromServer(doc(alice, "meets", "current")));
  await assertSucceeds(getDocFromServer(doc(admin, "meets", "current")));
  await fixture();
});
