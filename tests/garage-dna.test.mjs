import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Garage DNA keeps owner identity and machine metadata in the domain boundary", () => {
  const domains = readFileSync("src/services/domains.ts", "utf8");
  const garage = readFileSync("src/data/garage.ts", "utf8");

  for (const field of [
    "ownerMemberId",
    "drivetrain",
    "horsepower",
    "liveryTheme",
    "awards",
    "featured",
  ]) {
    assert.match(domains, new RegExp(field));
    assert.match(garage, new RegExp(field));
  }
});

test("ONI ID passport joins the approved account to crew and garage records", () => {
  const profile = readFileSync("src/data/profile.ts", "utf8");
  assert.match(profile, /row\.id === account\.memberId/);
  assert.match(profile, /vehicle\.ownerMemberId === account\.memberId/);
  assert.match(profile, /vehicles\.find\(\(vehicle\) => vehicle\.featured\)/);
});

test("Garage owner and vehicle links are restorable from URL parameters", () => {
  const source = readFileSync("src/components/oni/OniGarageStage.tsx", "utf8");
  assert.match(source, /params\.get\("owner"\)/);
  assert.match(source, /params\.get\("vehicle"\)/);
  assert.match(source, /url\.searchParams\.set\("vehicle", active\.id\)/);
});
