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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    try {
      await page.goto(`${origin}/join`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1000);

      const menuButton = page.getByRole("button", { name: "Цэс нээх" });
      await menuButton.click();
      await expectVisible(page.getByRole("navigation", { name: "Бүх хэсэг" }));
      await page.getByRole("button", { name: "Цэс хаах" }).click();

      const newExperience = page.getByRole("button", { name: "ШИНЭ", exact: true });
      await newExperience.click();
      assert.equal(await newExperience.getAttribute("aria-pressed"), "true");

      const drift = page.getByRole("button", { name: "ДРИФТ", exact: true });
      await drift.click();
      assert.equal(await drift.getAttribute("aria-pressed"), "true");
      await drift.click();
      assert.equal(await drift.getAttribute("aria-pressed"), "false");

      await page.getByRole("button", { name: /ХҮСЭЛТ ИЛГЭЭХ/ }).click();
      await page.getByText("Заавал бөглөх мэдээллүүдээ шалгана уу.").waitFor({ state: "visible" });
      assert.deepEqual(errors, []);
      console.log(`[${name}][interaction join] PASS`);

      await page.goto(`${origin}/profile`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1000);
      const registerTab = page.getByRole("button", { name: "БҮРТГҮҮЛЭХ", exact: true });
      const loginTab = page.getByRole("button", { name: "НЭВТРЭХ", exact: true });
      await registerTab.click();
      await expectVisible(page.getByText("CPM NICKNAME", { exact: true }));
      await loginTab.click();
      const forgotPassword = page.getByRole("button", { name: "НУУЦ ҮГ МАРТСАН" });
      await expectVisible(forgotPassword);
      await forgotPassword.click();
      await expectVisible(page.getByText("Зөв и-мэйл хаяг оруулна уу."));
      assert.deepEqual(errors, []);
      console.log(`[${name}][interaction profile] PASS`);
    } catch (error) {
      failed = true;
      console.error(`[${name}][interaction] FAIL`, error);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function expectVisible(locator) {
  await locator.waitFor({ state: "visible", timeout: 10000 });
  assert.equal(await locator.isVisible(), true);
}

if (failed) process.exitCode = 1;
