import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("custom push worker bounds cached assets and retains offline shell", async () => {
  const handlers = {};
  const entries = new Map();
  const cache = {
    put: async (request, response) => {
      entries.set(request.url, response);
    },
    keys: async () => [...entries.keys()].map((url) => ({ url })),
    delete: async (request) => entries.delete(request.url),
    addAll: async (paths) => paths.forEach((path) => entries.set(`https://oni.test${path}`, {})),
  };
  const context = vm.createContext({
    URL,
    Promise,
    self: {
      addEventListener: (name, fn) => {
        handlers[name] = fn;
      },
      location: { origin: "https://oni.test" },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => cache,
      match: async (request) => entries.get(request.url),
      keys: async () => ["oni-nexus-v4-static"],
      delete: async () => true,
    },
    fetch: async () => ({
      ok: true,
      type: "basic",
      clone() {
        return this;
      },
    }),
  });
  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);
  let install;
  handlers.install({
    waitUntil: (promise) => {
      install = promise;
    },
  });
  await install;
  const pending = [];
  for (let i = 0; i < 180; i++) {
    handlers.fetch({
      request: { method: "GET", mode: "cors", url: `https://oni.test/assets/file-${i}.js` },
      respondWith: (promise) => pending.push(promise),
      waitUntil: (promise) => pending.push(promise),
    });
  }
  // waitUntil work may enqueue while response promises resolve.
  for (let i = 0; i < 3; i++) await Promise.all(pending);
  assert.equal([...entries.keys()].filter((url) => url.includes("/assets/")).length, 96);
  assert.ok(entries.has("https://oni.test/offline.html"));
  assert.equal(typeof handlers.push, "function");
  assert.equal(typeof handlers.notificationclick, "function");
});

test("admin permission bridge keeps reduced owner actors actionable and explicit emails verified", () => {
  const source = readFileSync("src/services/admin-profiles.ts", "utf8");
  assert.match(source, /if \(!profile\) return false;/);
  assert.match(
    source,
    /if \(profile\.email\) \{\s*if \(!isAuthorizedAdmin\(profile\)\) return false;/,
  );
  assert.match(source, /else if \(profile\.role !== "owner"\) \{\s*return false;/);
  assert.match(source, /profile\.role === "owner" && isAdminEmail\(profile\.email\)/);
});

test("admin mobile review controls stay tappable and ONI AI stays compact", () => {
  const cleanup = readFileSync("src/admin-cleanup.css", "utf8");
  assert.match(cleanup, /max-height: 52svh !important/);
  assert.match(cleanup, /max-width: 24rem !important/);
  assert.match(cleanup, /section\[aria-label="CREW ACCOUNT"\] li button/);
  assert.match(cleanup, /button\[data-admin-application-action\]/);
  assert.match(cleanup, /touch-action: manipulation/);
});

test("Vercel Git auto-deployment is disabled and production workflow is manually gated", () => {
  assert.equal(JSON.parse(readFileSync("vercel.json", "utf8")).git.deploymentEnabled, false);
  const workflow = readFileSync(".github/workflows/vercel-prebuilt-production.yml", "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  const pushBlock = workflow.match(/  push:\n(?:    .*\n)+/m)?.[0] ?? "";
  if (pushBlock) {
    assert.match(pushBlock, /branches: \[main\]/);
    assert.match(pushBlock, /\.github\/production-deploy-trigger/);
  }
  assert.doesNotMatch(workflow, /^  (pull_request|workflow_run):/m);
});
