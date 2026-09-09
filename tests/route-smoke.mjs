import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const origin = process.env.KEI_APP_ORIGIN || "http://127.0.0.1:4174";
let failed = false;
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const route of [
      "/",
      "/join",
      "/crew",
      "/garage",
      "/gallery",
      "/meet",
      "/profile",
      "/progression",
      "/shop",
      "/music",
      "/oni-ai",
      "/admin",
    ]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        const response = await page.goto(origin + route, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        assert.equal(response?.status(), 200);
        await page.waitForTimeout(2000);
        const text = await page.locator("body").innerText();
        assert.ok(text.trim().length > 30, "blank page");
        assert.doesNotMatch(
          text,
          /This page didn.t load|Something went wrong|Internal Server Error/,
        );
        assert.equal(await page.locator("vite-error-overlay").count(), 0);
        assert.deepEqual(errors, []);
        if (route === "/admin") {
          assert.ok(text.includes("НЭВТРЭХ"), "signed-out admin should show sign-in");
          assert.ok(!text.includes("EVENT REWARD"), "reward dock must be hidden");
        }
        console.log(`[${name}][route ${route}] PASS`);
      } catch (error) {
        failed = true;
        console.error(`[${name}][route ${route}] FAIL`, error);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}
if (failed) process.exitCode = 1;
