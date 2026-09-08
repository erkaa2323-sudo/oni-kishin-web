import { spawn } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";

const children = [];
function server(command, args, log) {
  const child = spawn(command, args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const output = createWriteStream(log);
  child.stdout.pipe(output);
  child.stderr.pipe(output);
  children.push(child);
  return child;
}
async function ready(url, child) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${url}`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server readiness timeout: ${url}`);
}
function run(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { stdio: "inherit" });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}
try {
  const staticHost = server(
    "python3",
    ["-m", "http.server", "4173", "--bind", "127.0.0.1", "-d", "public"],
    "/tmp/oni-kei-static.log",
  );
  await ready("http://127.0.0.1:4173/kei-live2d-host.html", staticHost);
  const standalone = await run("tests/kei-browser-smoke.mjs");
  const cosmeticSource = await run("tests/cosmetic-fx.test.mjs");
  const cosmeticFx = await run("tests/cosmetic-fx-browser.mjs");
  // Run the actual built application, using its declared local runtime.
  const preset = JSON.parse(readFileSync(".output/nitro.json", "utf8")).preset;
  let app;
  if (preset === "node-server") {
    process.env.PORT = "4174";
    process.env.HOST = "127.0.0.1";
    app = server(process.execPath, [".output/server/index.mjs"], "/tmp/oni-built-app.log");
  } else {
    app = server(
      "node_modules/.bin/wrangler",
      [
        "dev",
        "--local",
        "--config",
        ".output/server/wrangler.json",
        "--ip",
        "127.0.0.1",
        "--port",
        "4174",
      ],
      "/tmp/oni-built-app.log",
    );
  }
  await ready("http://127.0.0.1:4174/meet", app);
  const integration = await run("tests/kei-meet-integration.mjs");
  const routes = await run("tests/route-smoke.mjs");
  if (!standalone || !cosmeticSource || !cosmeticFx || !integration || !routes)
    process.exitCode = 1;
} finally {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
}
