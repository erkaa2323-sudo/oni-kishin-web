import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = readFileSync("src/lib/oni-shop.ts", "utf8");
const data = readFileSync("src/data/shop.ts", "utf8");
const route = readFileSync("src/routes/shop.tsx", "utf8");
const stage = readFileSync("src/components/oni/OniShopV2Stage.tsx", "utf8");
const fx = readFileSync("src/components/oni/OniCosmeticBridge.tsx", "utf8");

const serviceIds = [...catalog.matchAll(/\bid: "([a-z0-9-]+)"/g)].map((match) => match[1]);

test("Shop V2 exposes exactly 22 CPM services with premium pricing", () => {
  assert.equal(serviceIds.length, 22);
  assert.equal(new Set(serviceIds).size, 22);
  assert.match(catalog, /id: "premium-30-day"[\s\S]*?price: 10000/);
  assert.match(catalog, /id: "name-color"[\s\S]*?price: 2500/);
  assert.match(catalog, /id: "king-rank"[\s\S]*?price: 6500/);
  assert.match(catalog, /id: "front-bumper"[\s\S]*?price: 1200/);
});

test("CPM service descriptions and Instagram handoff are explicit", () => {
  const descriptions = [...catalog.matchAll(/description:\s*\n?\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(descriptions.length, 22);
  for (const description of descriptions) assert.match(description, /CPM/);
  assert.match(catalog, /instagram\.com\/crewnike_/i);
  assert.match(stage, /АДМИНТАЙ INSTAGRAM-ААР ХОЛБОГДОХ/);
  assert.match(stage, /Coin таны wallet-аас автоматаар хасагдлаа/);
});

test("Shop V2 keeps public feed privacy-separated from private orders", () => {
  assert.match(data, /collection\(firebaseDb, "shopPurchaseFeed"\)/);
  assert.match(data, /doc\(firebaseDb, "shopOrders", orderId\)/);
  assert.match(data, /sourceType: "cpm_service_purchase"/);
  assert.doesNotMatch(data, /tx\.set\(feedRef,[\s\S]*?uid:/);
  assert.match(stage, /PUBLIC PURCHASE FEED/);
  assert.match(stage, /Account-ийн нууц мэдээлэл нийтэд харагдахгүй/);
});

test("Shop route is isolated from progression and premium effects are visibly amplified", () => {
  assert.match(route, /OniShopV2Stage/);
  assert.doesNotMatch(route, /OniProgressionStage/);
  assert.match(fx, /pathname\.startsWith\("\/profile"\)/);
  assert.match(fx, /oni-crimson-node/);
  assert.match(fx, /oni-red-moon-aura:before/);
  assert.match(fx, /oni-night-rider-title/);
  assert.match(fx, /oniGarageDrift/);
});
