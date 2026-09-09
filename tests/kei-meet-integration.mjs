import { chromium, webkit } from "playwright";

const origin = process.env.KEI_APP_ORIGIN || "http://127.0.0.1:4174";
const engines = [
  ["chromium", chromium],
  ["webkit", webkit],
];
let failed = false;

async function inspectKeiFrame(page) {
  const iframe = await page.$('iframe[title="Kei Cubism 5 Meet host"]');
  if (!iframe)
    return {
      frameFound: false,
      alpha: -1,
      alphaBounds: null,
      frameFit: null,
      frameContained: false,
      width: 0,
      height: 0,
      loadingText: "",
      frameUrl: "",
      diag: null,
      cubism: null,
    };
  const frame = await iframe.contentFrame();
  if (!frame)
    return {
      frameFound: false,
      alpha: -1,
      alphaBounds: null,
      frameFit: null,
      frameContained: false,
      width: 0,
      height: 0,
      loadingText: "",
      frameUrl: "",
      diag: null,
      cubism: null,
    };
  const result = await frame.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const loadingText = document.querySelector("#loading")?.textContent?.trim() || "";
    const frameFit = window.__KEIFRAME__ || null;
    let alpha = -1;
    let alphaBounds = null;
    let width = 0;
    let height = 0;
    if (canvas) {
      width = canvas.width;
      height = canvas.height;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl && width > 0 && height > 0) {
        const data = new Uint8Array(width * height * 4);
        gl.finish();
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
        let count = 0;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        for (let i = 3; i < data.length; i += 16) {
          if (data[i] <= 8) continue;
          count++;
          const pixel = (i - 3) / 4;
          const x = pixel % width;
          const glY = Math.floor(pixel / width);
          const y = height - 1 - glY;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
        alpha = count;
        if (count > 0) alphaBounds = { minX, minY, maxX, maxY };
      }
    }
    const tolerance = 16;
    const leftSafe = frameFit ? (width - frameFit.usableW) * 0.5 : 0;
    const rightSafe = frameFit ? width - leftSafe : width;
    const frameContained = Boolean(
      frameFit &&
      alphaBounds &&
      alphaBounds.minX >= leftSafe - tolerance &&
      alphaBounds.maxX <= rightSafe + tolerance &&
      alphaBounds.minY >= frameFit.topSafe - tolerance &&
      alphaBounds.maxY <= height - frameFit.bottomSafe + tolerance,
    );
    return {
      frameFound: true,
      alpha,
      alphaBounds,
      frameFit,
      frameContained,
      width,
      height,
      loadingText,
      diag: window.__KEIDIAG__ || null,
      cubism: window.__KEICUBISM__ || null,
    };
  });
  return { ...result, frameUrl: frame.url() };
}

for (const [name, browserType] of engines) {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(String(err?.stack || err)));

    const response = await page.goto(`${origin}/meet`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    const status = response?.status() ?? 0;
    await page.waitForSelector('iframe[title="Kei Cubism 5 Meet host"]', { timeout: 30000 });

    // Parent only flips to VISIBLE after the child reports a real pixel-verified ready event.
    await page.waitForFunction(
      () => {
        const badges = Array.from(document.querySelectorAll("span"));
        return badges.some((el) => el.textContent?.trim() === "VISIBLE");
      },
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(600);

    const frameResult = await inspectKeiFrame(page);
    const parentVisible = await page
      .locator("span", { hasText: /^VISIBLE$/ })
      .count()
      .then((n) => n > 0);
    const body = await page.locator("body").innerText();
    const parentError = body.includes("RENDER ERROR") || body.includes("KEI RENDER ERROR");
    const ok =
      status === 200 &&
      parentVisible &&
      !parentError &&
      frameResult.frameFound &&
      frameResult.alpha > 0 &&
      frameResult.frameContained &&
      !/RENDER ERROR/i.test(frameResult.loadingText);

    console.log(
      `\n[${name}][meet-integration]`,
      JSON.stringify({ status, parentVisible, parentError, ...frameResult }),
    );
    if (consoleErrors.length)
      console.log(`[${name}][meet-integration] console-error:`, consoleErrors.join("\n"));
    if (pageErrors.length)
      console.log(`[${name}][meet-integration] pageerror:`, pageErrors.join("\n"));

    if (!ok) {
      failed = true;
      console.error(
        `[${name}][meet-integration] FAILED: /meet did not expose a pixel-verified, safe-framed Kei host.`,
      );
    } else {
      console.log(
        `[${name}][meet-integration] PASS: /meet Kei pixels stay inside the mobile safe frame.`,
      );
    }
    await page.close();
  } catch (err) {
    failed = true;
    console.error(`[${name}][meet-integration] FATAL`, err);
  } finally {
    await browser.close();
  }
}

if (failed) process.exit(1);
