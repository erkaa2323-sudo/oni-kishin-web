import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const component = readFileSync("src/components/oni/OniCosmeticFx.tsx", "utf8");
const styles = readFileSync("src/components/oni/OniCosmeticFx.css", "utf8");
const presets = readFileSync("src/lib/cosmetics/oni-fx-presets.ts", "utf8");
const social = readFileSync("src/components/oni/OniSocialHub.tsx", "utf8");
const routeFx = readFileSync("src/components/oni/OniMemberRouteFx.tsx", "utf8");
const preview = readFileSync("src/components/oni/OniVaultPreviewDock.tsx", "utf8");
const progressionRoute = readFileSync("src/routes/progression.tsx", "utf8");
const myCosmetics = readFileSync("src/hooks/useMyCosmetics.ts", "utf8");

const vaultIds = [
  "frame-crimson",
  "aura-red-moon",
  "garage-neon",
  "shizuki-kitsune",
  "title-night-rider",
  "entrance-kishin",
  "creator-red-moon",
  "trophy-vault",
];

test("all vault cosmetics are mapped into the FX engine", () => {
  for (const id of vaultIds) {
    assert.match(presets, new RegExp(`\\"${id}\\"`));
  }
  assert.match(social, /<OniCosmeticFx/);
  assert.match(social, /effectIds=\{equippedIds\}/);
});

test("equipped cosmetics activate only in their intended member routes", () => {
  assert.match(routeFx, /\/garage/);
  assert.match(routeFx, /garage-neon/);
  assert.match(routeFx, /\/oni-ai/);
  assert.match(routeFx, /shizuki-kitsune/);
  assert.match(routeFx, /\/meet/);
  assert.match(routeFx, /entrance-kishin/);
  assert.match(routeFx, /\/gallery/);
  assert.match(routeFx, /creator-red-moon/);
  assert.match(routeFx, /\/crew/);
  assert.match(routeFx, /title-night-rider/);
  assert.match(routeFx, /trophy-vault/);
});

test("equipped state stays live without polling", () => {
  assert.match(myCosmetics, /onSnapshot/);
  assert.match(myCosmetics, /progressionProfiles/);
  assert.equal(myCosmetics.includes("setInterval"), false);
});

test("Vault preview uses one live GPU surface for all eight items", () => {
  assert.match(progressionRoute, /OniVaultPreviewDock/);
  assert.match(preview, /ONI_VAULT\.map/);
  assert.match(preview, /effectIds=\{\[selected\.id\]\}/);
  assert.equal((preview.match(/<OniCosmeticFx/g) ?? []).length, 1);
});

test("FX renderer uses GPU atmosphere and mobile performance guards", () => {
  assert.match(component, /getContext\("webgl"/);
  assert.match(component, /float fbm\(/);
  assert.match(component, /ResizeObserver/);
  assert.match(component, /IntersectionObserver/);
  assert.match(component, /hardwareConcurrency/);
  assert.match(component, /devicePixelRatio/);
  assert.match(component, /ambient[\s\S]*?\?\s*1\.35/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("premium FX do not regress into generic line cosmetics", () => {
  const fxSource = `${component}\n${styles}\n${presets}`.toLowerCase();
  for (const forbidden of [
    "dashed",
    "dotted",
    "repeating-linear-gradient",
    "neon grid",
    "border-animation",
  ]) {
    assert.equal(fxSource.includes(forbidden), false, `forbidden visual primitive: ${forbidden}`);
  }
});
