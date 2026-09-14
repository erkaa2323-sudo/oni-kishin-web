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

      const continueButton = page.getByRole("button", { name: /Үргэлжлүүлэх/ });
      await continueButton.click();
      await expectVisible(page.getByText("Улаанаар тэмдэглэсэн мэдээллийг шалгана уу."));
      await expectVisible(page.getByRole("heading", { name: "Хувийн мэдээлэл" }));

      await page.locator('input[autocomplete="family-name"]').fill("Smoke Family");
      await page.locator('input[autocomplete="given-name"]').fill("Smoke Rider");
      await page.locator('input[type="number"]').fill("24");
      await continueButton.click();
      await expectVisible(page.getByRole("heading", { name: "CPM мэдээлэл" }));

      await page.getByPlaceholder("ONI RIDER").fill("SMOKE RIDER");
      await page.getByPlaceholder("ONI0001").fill("SMOKE-001");
      await continueButton.click();
      await expectVisible(page.getByRole("heading", { name: "Туршлага ба холбоо" }));

      await page.getByPlaceholder("@username").fill("@smoke");
      await page.getByRole("button", { name: "ШИНЭ", exact: true }).click();
      await page.getByRole("button", { name: "ДРИФТ", exact: true }).click();
      await continueButton.click();
      await expectVisible(page.getByRole("heading", { name: "Шалгах ба илгээх" }));
      await expectVisible(page.getByText("Smoke Family Smoke Rider", { exact: true }));
      await expectVisible(page.getByText("SMOKE RIDER · SMOKE-001", { exact: true }));
      await expectVisible(page.getByText("Instagram · @smoke", { exact: true }));
      await expectVisible(page.getByRole("button", { name: /Хүсэлт илгээх/ }));

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
