import { chromium, webkit } from "playwright";

const origin = process.env.KEI_TEST_ORIGIN || "http://127.0.0.1:4173";
const live2dUrl = `${origin}/kei-live2d-host.html`;
const textureUrl = `${origin}/kei-pixi-texture-test.html`;
const engines = [
  ["chromium", chromium],
  ["webkit", webkit],
];

let failed = false;

async function inspectCanvas(page) {
  return page.evaluate(() => {
    const loading = document.querySelector("#loading");
    const canvas = document.querySelector("canvas");
    const loadingText = loading?.textContent?.trim() || "";
    let alpha = -1,
      width = 0,
      height = 0,
      glError = "";
    if (canvas) {
      width = canvas.width;
      height = canvas.height;
      try {
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (gl && width > 0 && height > 0) {
          const data = new Uint8Array(width * height * 4);
          gl.finish();
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
          let count = 0;
          for (let i = 3; i < data.length; i += 64) if (data[i] > 8) count++;
          alpha = count;
        }
      } catch (err) {
        glError = String(err?.message || err);
      }
    }
    return {
      loadingExists: !!loading,
      loadingText,
      canvasExists: !!canvas,
      width,
      height,
      alpha,
      glError,
      pixiTest: window.__PIXITEST__ || null,
    };
  });
}

for (const [name, browserType] of engines) {
  const browser = await browserType.launch({ headless: true });
  try {
    // A: raw PixiJS 8 texture upload/render, no Live2D engine involved.
    {
      const page = await browser.newPage({
        viewport: { width: 430, height: 650 },
        deviceScaleFactor: 1,
      });
      const consoleMessages = [],
        pageErrors = [];
      page.on("console", (msg) => {
        if (["error", "warning"].includes(msg.type()))
          consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      });
      page.on("pageerror", (err) => pageErrors.push(String(err?.stack || err)));
      await page.goto(textureUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(900);
      const result = await inspectCanvas(page);
      const ok = result.pixiTest?.ok === true && result.canvasExists && result.alpha > 0;
      console.log(`\n[${name}][raw-pixi-texture]`, JSON.stringify(result));
      if (consoleMessages.length)
        console.log(`[${name}][raw-pixi-texture] console:`, consoleMessages.join("\n"));
      if (pageErrors.length)
        console.log(`[${name}][raw-pixi-texture] pageerror:`, pageErrors.join("\n"));
      if (!ok) {
        failed = true;
        console.error(`[${name}][raw-pixi-texture] FAILED: raw PNG/Pixi GPU upload is broken.`);
      } else {
        console.log(`[${name}][raw-pixi-texture] PASS: PNG uploads and renders through PixiJS 8.`);
      }
      await page.close();
    }

    // B: same browser/GPU, Live2D engine rendering the same texture.
    {
      const page = await browser.newPage({
        viewport: { width: 430, height: 650 },
        deviceScaleFactor: 1,
      });
      const consoleMessages = [],
        pageErrors = [];
      page.on("console", (msg) => {
        if (["error", "warning"].includes(msg.type()))
          consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      });
      page.on("pageerror", (err) => pageErrors.push(String(err?.stack || err)));
      await page.goto(live2dUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      const result = await inspectCanvas(page);
      const ok =
        result.canvasExists &&
        result.width > 0 &&
        result.height > 0 &&
        result.alpha > 0 &&
        !/RENDER ERROR/i.test(result.loadingText);
      console.log(`\n[${name}][live2d]`, JSON.stringify(result));
      if (consoleMessages.length)
        console.log(`[${name}][live2d] console:`, consoleMessages.join("\n"));
      if (pageErrors.length) console.log(`[${name}][live2d] pageerror:`, pageErrors.join("\n"));
      if (!ok) {
        failed = true;
        console.error(
          `[${name}][live2d] FAILED: Live2D engine did not produce visible alpha pixels.`,
        );
      } else {
        console.log(`[${name}][live2d] PASS: visible Kei pixels detected.`);
      }
      await page.close();
    }
  } catch (err) {
    failed = true;
    console.error(`[${name}] FATAL`, err);
  } finally {
    await browser.close();
  }
}

if (failed) process.exit(1);
