import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const component = readFileSync("src/components/oni/OniCosmeticFx.tsx", "utf8");
const styles = readFileSync("src/components/oni/OniCosmeticFx.css", "utf8");
const presets = readFileSync("src/lib/cosmetics/oni-fx-presets.ts", "utf8");
const social = readFileSync("src/components/oni/OniSocialHub.tsx", "utf8");

test("reference cosmetics are mapped into the FX engine", () => {
  for (const id of ["frame-crimson", "aura-red-moon", "entrance-kishin"]) {
    assert.match(presets, new RegExp(`\\"${id}\\"`));
  }
  assert.match(social, /<OniCosmeticFx/);
  assert.match(social, /effectIds=\{equippedIds\}/);
});

test("FX renderer uses GPU atmosphere and mobile performance guards", () => {
  assert.match(component, /getContext\("webgl"/);
  assert.match(component, /float fbm\(/);
  assert.match(component, /ResizeObserver/);
  assert.match(component, /IntersectionObserver/);
  assert.match(component, /hardwareConcurrency/);
  assert.match(component, /devicePixelRatio/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("reference FX do not regress into dashed or generic line cosmetics", () => {
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
