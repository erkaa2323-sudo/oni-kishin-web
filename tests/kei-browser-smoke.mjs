import { chromium, webkit } from 'playwright';

const base = process.env.KEI_TEST_URL || 'http://127.0.0.1:4173/kei-live2d-host.html';
const engines = [
  ['chromium', chromium],
  ['webkit', webkit],
];

let failed = false;

for (const [name, browserType] of engines) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 650 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') consoleErrors.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => pageErrors.push(String(err?.stack || err)));

  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      const loading = document.querySelector('#loading');
      const canvas = document.querySelector('canvas');
      const loadingText = loading?.textContent?.trim() || '';
      let alpha = -1;
      let width = 0;
      let height = 0;
      let glError = '';
      if (canvas) {
        width = canvas.width;
        height = canvas.height;
        try {
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
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
      return { loadingExists: !!loading, loadingText, canvasExists: !!canvas, width, height, alpha, glError };
    });

    const ok = result.canvasExists && result.width > 0 && result.height > 0 && result.alpha > 0 && !/RENDER ERROR/i.test(result.loadingText);
    console.log(`\n[${name}]`, JSON.stringify(result));
    if (consoleErrors.length) console.log(`[${name}] console:`, consoleErrors.join('\n'));
    if (pageErrors.length) console.log(`[${name}] pageerror:`, pageErrors.join('\n'));
    if (!ok) {
      failed = true;
      console.error(`[${name}] FAILED: Kei did not produce visible alpha pixels.`);
    } else {
      console.log(`[${name}] PASS: visible Kei pixels detected.`);
    }
  } catch (err) {
    failed = true;
    console.error(`[${name}] FATAL`, err);
    if (consoleErrors.length) console.error(consoleErrors.join('\n'));
    if (pageErrors.length) console.error(pageErrors.join('\n'));
  } finally {
    await browser.close();
  }
}

if (failed) process.exit(1);
