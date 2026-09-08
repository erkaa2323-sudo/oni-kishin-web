import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

let env;
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
    await setDoc(doc(context.firestore(), "products", "real-product"), {
      name: "Change Gmail",
      price: 6000,
    });
    await setDoc(doc(context.firestore(), "products", "invalid-product"), {
      name: "Invalid",
      price: "6000",
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
