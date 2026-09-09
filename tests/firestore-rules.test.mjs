import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { Timestamp, doc, setDoc, writeBatch } from "firebase/firestore";

let env;
const meetStart = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
const previousMeetStart = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);

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
    await setDoc(doc(db, "meets", "current"), {
      title: "NEXT MEET",
      enabled: true,
      status: "scheduled",
      startAt: meetStart,
      registrationClosesAt: Timestamp.fromMillis(meetStart.toMillis() + 20 * 60 * 1000),
      maxPlayers: 20,
      createdAt: Timestamp.now(),
    });
  });
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
