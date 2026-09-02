import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function checkRequiredFiles() {
  const required = [
    "v2/index.html",
    "v2/manifest.webmanifest",
    "v2/sw.js",
    "v2/css/tokens.css",
    "v2/css/app.css",
    "v2/css/components.css",
    "v2/js/app.js",
    "v2/js/router.js",
    "v2/js/firebase.js",
    "v2/js/auth.js",
    "v2/js/members.js",
    "v2/js/garage.js",
    "v2/js/music.js",
    "v2/js/meet.js",
    "v2/js/market.js",
    "v2/js/oni-ai.js",
    "v2/admin/index.html",
    "v2/worker/index.js",
    "index.html",
    "manifest.webmanifest",
    "sw.js"
  ];

  for (const file of required) {
    assert(exists(file), `Missing required file: ${file}`);
  }
}

function checkManifest() {
  let manifest;
  try {
    manifest = JSON.parse(read("v2/manifest.webmanifest"));
  } catch (error) {
    assert(false, `v2/manifest.webmanifest invalid JSON: ${error.message}`);
    return;
  }

  const required = ["name", "short_name", "id", "start_url", "scope", "display", "theme_color", "background_color"];
  for (const key of required) {
    assert(typeof manifest[key] === "string" && manifest[key].length > 0, `V2 manifest missing/invalid: ${key}`);
  }

  assert(manifest.id === "/oni-kishin-web/v2/", "V2 manifest id must be /oni-kishin-web/v2/");
  assert(manifest.start_url === "/oni-kishin-web/v2/", "V2 manifest start_url must be /oni-kishin-web/v2/");
  assert(manifest.scope === "/oni-kishin-web/v2/", "V2 manifest scope must be /oni-kishin-web/v2/");

  assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, "V2 manifest icons must be a non-empty array");
  for (const icon of manifest.icons || []) {
    assert(typeof icon.src === "string" && icon.src.length > 0, "V2 manifest icon src missing");
    if (typeof icon.src === "string") {
      const normalized = path.posix.normalize(path.posix.join("v2", icon.src));
      assert(exists(normalized), `V2 manifest icon missing file: ${icon.src} -> ${normalized}`);
    }
  }
}

function checkJavaScriptSyntax() {
  const files = [
    "v2/sw.js",
    "v2/worker/index.js",
    ...fs.readdirSync(path.join(root, "v2/js")).filter(name => name.endsWith(".js")).map(name => `v2/js/${name}`)
  ];

  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    if (result.status !== 0) {
      errors.push(`JS syntax failed: ${file}\n${(result.stderr || result.stdout || "").trim()}`);
    }
  }
}

function checkLocalModuleImports() {
  const files = [
    ...fs.readdirSync(path.join(root, "v2/js")).filter(name => name.endsWith(".js")).map(name => `v2/js/${name}`),
    "v2/worker/index.js"
  ];

  const importRegex = /import\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g;
  for (const file of files) {
    const abs = path.join(root, file);
    const dir = path.dirname(abs);
    const content = fs.readFileSync(abs, "utf8");

    for (const match of content.matchAll(importRegex)) {
      const specifier = match[1];
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;
      const target = path.resolve(dir, specifier);
      assert(fs.existsSync(target), `Broken module path in ${file}: ${specifier}`);
    }
  }
}

function checkFirebaseModuleImportValidity() {
  const source = read("v2/js/firebase.js");
  assert(
    source.includes('from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js"'),
    "v2/js/firebase.js must import firebase-app from official CDN URL"
  );
  assert(
    source.includes('from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js"'),
    "v2/js/firebase.js must import firebase-firestore from official CDN URL"
  );
  assert(source.includes("export function getFirebase()"), "v2/js/firebase.js must export getFirebase()");
  assert(source.includes("initializeApp("), "v2/js/firebase.js must initialize Firebase app safely");
  assert(source.includes("getApps().length ? getApp() : initializeApp"), "v2/js/firebase.js must avoid duplicate app initialization");
}

function fileSha256(file) {
  return createHash("sha256").update(read(file)).digest("hex");
}

function checkProtectedProductionFilesUnchanged() {
  const expectedHashes = {
    "index.html": "3e638039c5615524f0aa2d6ff53f2085711ccaaff3c9e9f819d6f74ca4115573",
    "sw.js": "89e9905613ba671152fc0f29dbbf7e0e414d0014810ae934d337acd76eb7d47f",
    "manifest.webmanifest": "154b095bb96721f52cf934f3a1218e34659ad7cb4a655170aa836e05441f1dff",
    "src/index.js": "3dcc488d085add35100306a10ea76cb9110dc6148a31240fd388f4e12f69e20e",
    "src/secure-worker.js": "8a421913cfcd58f549e0a8bbf9dfe72369493a28c64918152ca01b3d02e7fff1",
    "firestore.rules": "d9ec1a844dbee1214dd9dbd373d2284ba4a769b8f8a838f46fd69609fe80e6be",
    "storage.rules": "6d7ad803382f334453016eb89d6de8c4bfd33b854c1c9b2c31c2ecb9cb5e1ea9"
  };

  for (const [file, expected] of Object.entries(expectedHashes)) {
    const actual = fileSha256(file);
    assert(actual === expected, `Protected file changed: ${file}`);
  }
}

function compileMembersValidationExports({ docs = [] } = {}) {
    const source = read("v2/js/members.js");
    const transformed = source
        .replace(/^import\s.+?;\s*$/gm, "")
        .replace(/export function\s+/g, "function ")
      + "\nmodule.exports = { createMembersModule, normalizeMemberRecord, filterMembers, membersRouteMarkup, renderMembersCards };";

    let getDocsCalls = 0;
    const context = {
      module: { exports: {} },
      exports: {},
      console,
      Math,
      Date,
      setTimeout,
      clearTimeout,
      HTMLElement: class HTMLElement {},
      collection: () => ({ name: "members" }),
      getFirestoreDb: () => ({}),
      getDocs: async () => {
        getDocsCalls += 1;
        return {
          docs: docs.map(item => ({
            id: item.id,
            data: () => item.data
          }))
        };
}
    };

    vm.runInNewContext(transformed, context, { filename: "v2/js/members.js" });
    return {
      exports: context.module.exports,
      HTMLElement: context.HTMLElement,
      getDocsCalls: () => getDocsCalls
    };
  }

function createFakeMembersRoot(HTMLElementCtor) {
    class FakeNode {
      constructor() {
        this.value = "";
        this.textContent = "";
        this.innerHTML = "";
        this.listeners = new Map();
}
      addEventListener(type, handler) {
        this.listeners.set(type, handler);
      }
      removeEventListener(type, handler) {
        if (this.listeners.get(type) === handler) this.listeners.delete(type);
      }
      querySelector() {
        return null;
      }
    }

    class FakeRoot extends HTMLElementCtor {
      constructor() {
        super();
        this.innerHTML = "";
        this.nodes = new Map([
          ["[data-members-search]", new FakeNode()],
          ["[data-members-role]", new FakeNode()],
          ["[data-members-retry]", new FakeNode()],
          ["[data-members-state]", new FakeNode()],
          ["[data-members-grid]", new FakeNode()]
        ]);
      }
      querySelector(selector) {
        return this.nodes.get(selector) || null;
      }
    }

    return new FakeRoot();
  }

function compileGarageValidationExports({ docs = [] } = {}) {
    const source = read("v2/js/garage.js");
    const transformed = source
        .replace(/^import\s.+?;\s*$/gm, "")
        .replace(/export function\s+/g, "function ")
      + "\nmodule.exports = { createGarageModule, normalizeGarageRecord, filterGarageRecords, garageRouteMarkup, renderGarageCards };";

    let getDocsCalls = 0;
    const collections = [];
    const context = {
      module: { exports: {} },
      exports: {},
      console,
      Math,
      Date,
      setTimeout,
      clearTimeout,
      HTMLElement: class HTMLElement {},
      HTMLSelectElement: class HTMLSelectElement {},
      HTMLImageElement: class HTMLImageElement {},
      collection: (_, name) => {
        collections.push(name);
        return { name };
      },
      getFirestoreDb: () => ({}),
      getDocs: async () => {
        getDocsCalls += 1;
        return {
          docs: docs.map(item => ({
            id: item.id,
            data: () => item.data
          }))
        };
      }
    };

    vm.runInNewContext(transformed, context, { filename: "v2/js/garage.js" });
    return {
      exports: context.module.exports,
      HTMLElement: context.HTMLElement,
      HTMLSelectElement: context.HTMLSelectElement,
      getDocsCalls: () => getDocsCalls,
      collections: () => collections.slice()
    };
  }

function createFakeGarageRoot(HTMLElementCtor, HTMLSelectElementCtor) {
    class FakeNode {
      constructor() {
        this.value = "";
        this.textContent = "";
        this.innerHTML = "";
        this.listeners = new Map();
      }
      addEventListener(type, handler) {
        this.listeners.set(type, handler);
      }
      removeEventListener(type, handler) {
        if (this.listeners.get(type) === handler) this.listeners.delete(type);
      }
      querySelector() {
        return null;
      }
    }

    class FakeSelect extends HTMLSelectElementCtor {
      constructor() {
        super();
        this.value = "all";
        this.innerHTML = "";
        this.dataset = {};
      }
    }

    class FakeFilterGrid extends FakeNode {
      constructor() {
        super();
        this.typeSelect = new FakeSelect();
        this.typeSelect.dataset.garageFilter = "type";
        this.categorySelect = new FakeSelect();
        this.categorySelect.dataset.garageFilter = "category";
        this.statusSelect = new FakeSelect();
        this.statusSelect.dataset.garageFilter = "status";
      }
      querySelector(selector) {
        if (selector === '[data-garage-filter="type"]') return this.typeSelect;
        if (selector === '[data-garage-filter="category"]') return this.categorySelect;
        if (selector === '[data-garage-filter="status"]') return this.statusSelect;
        return null;
      }
    }

    class FakeRoot extends HTMLElementCtor {
      constructor() {
        super();
        this.innerHTML = "";
        this.nodes = new Map([
          ["[data-garage-search]", new FakeNode()],
          ["[data-garage-filter-grid]", new FakeFilterGrid()],
          ["[data-garage-retry]", new FakeNode()],
          ["[data-garage-state]", new FakeNode()],
          ["[data-garage-grid]", new FakeNode()]
        ]);
      }
      querySelector(selector) {
        return this.nodes.get(selector) || null;
      }
    }

    return new FakeRoot();
  }

async function checkMembersModuleBehavior() {
    const sampleDocs = [
      { id: "m1", data: { nick: "KITSUNE", cpmid: "CPM-001", role: "leader", title: "LEADER", direction: "Clean Car", createdAt: { seconds: 1 } } },
      { id: "m2", data: { nickname: "NOIR", cpmId: "CPM-002", role: "co-leader", image: "https://example.com/avatar.webp", createdAt: { seconds: 2 } } },
      { id: "m3", data: { name: "Legacy Member", role: "member", createdAt: { seconds: 3 } } }
    ];
    const { exports, HTMLElement, getDocsCalls } = compileMembersValidationExports({ docs: sampleDocs });

    const { normalizeMemberRecord, filterMembers, membersRouteMarkup, createMembersModule, renderMembersCards } = exports;
    assert(typeof normalizeMemberRecord === "function", "v2/js/members.js must export normalizeMemberRecord()");
    assert(typeof filterMembers === "function", "v2/js/members.js must export filterMembers()");
    assert(typeof membersRouteMarkup === "function", "v2/js/members.js must export membersRouteMarkup()");
    assert(typeof renderMembersCards === "function", "v2/js/members.js must export renderMembersCards()");
    assert(typeof createMembersModule === "function", "v2/js/members.js must export createMembersModule()");

    const markup = membersRouteMarkup();
    const idMatches = [...markup.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
    const idCounts = new Map();
    for (const id of idMatches) idCounts.set(id, (idCounts.get(id) || 0) + 1);
    for (const [id, count] of idCounts.entries()) {
      if (count > 1) errors.push(`Duplicate DOM id in members route markup: ${id} (${count}x)`);
    }

    const legacy = normalizeMemberRecord({ nickname: "LegacyNick", cpmId: "CPM-LEGACY", role: "special" }, "legacy-1");
    assert(legacy.nickname === "LegacyNick", "Legacy nickname field must map correctly");
    assert(legacy.cpmId === "CPM-LEGACY", "Legacy cpmId field must map correctly");
    assert(legacy.role === "special", "Legacy role should be preserved");

    const missing = normalizeMemberRecord({}, "missing-1");
    assert(missing.nickname.length > 0, "Missing nickname must fall back safely");
    assert(missing.cpmId.length > 0, "Missing cpmId must fall back safely");

    const filtered = filterMembers([legacy, missing], "legacynick", "all");
    assert(filtered.length === 1, "Members filter must support search text matching");

  const renderedCards = renderMembersCards(sampleDocs.map(item => normalizeMemberRecord(item.data, item.id)));
  assert(renderedCards.includes("KITSUNE"), "Members rendering must include representative legacy roster records");
  assert(renderedCards.includes("CPM-001"), "Members rendering must show CPM ID");

  const module = createMembersModule();
  const root = createFakeMembersRoot(HTMLElement);
  module.mount(root);
  module.mount(root);
  await Promise.resolve();
  await Promise.resolve();

  assert(getDocsCalls() === 1, "Members route must mount once and avoid duplicate collection reads");
}

async function checkGarageModuleBehavior() {
    const sampleDocs = [
      {
        id: "g1",
        data: {
          name: "AKUMA EVO IX",
          owner: "KITSUNE",
          category: "anime",
          type: "drift",
          status: "ready",
          image: "https://example.com/evo.webp",
          createdAt: { seconds: 4 }
        }
      },
      {
        id: "g2",
        data: {
          title: "Legacy RX7",
          brand: "Mazda",
          model: "FD3S",
          nick: "NOIR",
          saleStatus: "active",
          images: ["https://example.com/rx7.webp"],
          updatedAt: { seconds: 5 }
        }
      },
      {
        id: "g3",
        data: {
          build: "Mystery Build"
        }
      }
    ];

    const {
      exports,
      HTMLElement,
      HTMLSelectElement,
      getDocsCalls,
      collections
    } = compileGarageValidationExports({ docs: sampleDocs });

    const {
      createGarageModule,
      normalizeGarageRecord,
      filterGarageRecords,
      garageRouteMarkup,
      renderGarageCards
    } = exports;

    assert(typeof normalizeGarageRecord === "function", "v2/js/garage.js must export normalizeGarageRecord()");
    assert(typeof filterGarageRecords === "function", "v2/js/garage.js must export filterGarageRecords()");
    assert(typeof garageRouteMarkup === "function", "v2/js/garage.js must export garageRouteMarkup()");
    assert(typeof renderGarageCards === "function", "v2/js/garage.js must export renderGarageCards()");
    assert(typeof createGarageModule === "function", "v2/js/garage.js must export createGarageModule()");

    const markup = garageRouteMarkup();
    const idMatches = [...markup.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
    const idCounts = new Map();
    for (const id of idMatches) idCounts.set(id, (idCounts.get(id) || 0) + 1);
    for (const [id, count] of idCounts.entries()) {
      if (count > 1) errors.push(`Duplicate DOM id in garage route markup: ${id} (${count}x)`);
    }

    const normalizedLegacy = normalizeGarageRecord(sampleDocs[1].data, "legacy-1");
    assert(normalizedLegacy.buildName === "Legacy RX7", "Legacy garage title must map to buildName");
    assert(normalizedLegacy.owner === "NOIR", "Legacy garage nick must map to owner");
    assert(normalizedLegacy.status === "active", "Legacy garage saleStatus must map to status");

    const missing = normalizeGarageRecord({}, "missing-1");
    assert(missing.buildName.length > 0, "Missing garage build name must fall back safely");
    assert(Array.isArray(missing.images), "Missing garage images must fall back to an empty array");

    const records = sampleDocs.map(item => normalizeGarageRecord(item.data, item.id));
    const rendered = renderGarageCards(records);
    assert(rendered.includes("AKUMA EVO IX"), "Garage rendering must include current schema records");
    assert(rendered.includes("Legacy RX7"), "Garage rendering must include legacy schema records");

    const bySearch = filterGarageRecords(records, "mazda", { type: "all", category: "all", status: "all" });
    assert(bySearch.length === 1, "Garage filter must support search text matching");

    const byType = filterGarageRecords(records, "", { type: "drift", category: "all", status: "all" });
    assert(byType.length === 1, "Garage filter must support type filtering");

    const byStatus = filterGarageRecords(records, "", { type: "all", category: "all", status: "active" });
    assert(byStatus.length === 1, "Garage filter must support status filtering");

    const module = createGarageModule();
    const root = createFakeGarageRoot(HTMLElement, HTMLSelectElement);
    module.mount(root);
    module.mount(root);
    await Promise.resolve();
    await Promise.resolve();

    assert(getDocsCalls() === 1, "Garage route must mount once and avoid duplicate collection reads");
    assert(collections().includes("garage"), "Garage route must read from the Firestore garage collection");
  }

function checkServiceWorkerPrecache() {
  const sw = read("v2/sw.js");
  const shellMatch = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
  if (!shellMatch) {
    assert(false, "v2/sw.js missing APP_SHELL array");
    return;
  }

  const body = shellMatch[1];
  const baseEntries = [...body.matchAll(/BASE\s*\+\s*"([^"]+)"/g)].map(m => `v2/${m[1]}`);
  const absoluteEntries = [...body.matchAll(/"(\/oni-kishin-web\/[^"]+)"/g)]
    .map(m => m[1].replace(/^\/oni-kishin-web\//, ""));

  const entries = [...new Set([...baseEntries, ...absoluteEntries].map(entry => path.posix.normalize(entry)))];
  for (const rel of entries) {
    assert(exists(rel), `v2/sw.js precache references missing file: ${rel}`);
  }
}

function checkDuplicateIds() {
  const htmlFiles = ["v2/index.html", "v2/admin/index.html"];
  const idRegex = /\sid=["']([^"']+)["']/g;

  for (const file of htmlFiles) {
    const seen = new Map();
    const content = read(file);

    for (const match of content.matchAll(idRegex)) {
      const id = match[1];
      seen.set(id, (seen.get(id) || 0) + 1);
    }

    for (const [id, count] of seen.entries()) {
      if (count > 1) {
        errors.push(`Duplicate element ID in ${file}: ${id} (${count}x)`);
      }
    }
  }
}

function normalizeAssetPath(htmlFile, raw) {
  const value = raw.split("#")[0].split("?")[0].trim();
  if (!value || value === "/") return null;
  if (/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value)) return null;
  if (value.startsWith("#")) return null;

  if (value.startsWith("/oni-kishin-web/")) {
    return value.replace(/^\/oni-kishin-web\//, "");
  }

  if (value.startsWith("/")) return null;

  const fromDir = path.posix.dirname(htmlFile);
  return path.posix.normalize(path.posix.join(fromDir, value));
}

function checkLocalAssetReferences() {
  const htmlFiles = ["v2/index.html", "v2/admin/index.html"];
  const attrRegex = /\s(?:href|src)=["']([^"']+)["']/g;

  for (const file of htmlFiles) {
    const content = read(file);
    for (const match of content.matchAll(attrRegex)) {
      const candidate = normalizeAssetPath(file, match[1]);
      if (!candidate) continue;
      assert(exists(candidate), `Broken local asset reference in ${file}: ${match[1]} -> ${candidate}`);
    }
  }
}

function checkV2Isolation() {
  const v2Index = read("v2/index.html");
  const v2App = read("v2/js/app.js");
  const v2Sw = read("v2/sw.js");

  assert(v2Index.includes("./manifest.webmanifest"), "v2/index.html must link v2 manifest");
  assert(v2App.includes('const BASE = "/oni-kishin-web/v2/";'), "v2/js/app.js must register v2 scope only");
  assert(v2Sw.includes('const BASE = "/oni-kishin-web/v2/";'), "v2/sw.js BASE must stay /oni-kishin-web/v2/");
  assert(v2Sw.includes('url.pathname.startsWith("/oni-kishin-web/v2/")'), "v2/sw.js fetch handling must stay restricted to /v2/");
}

async function run() {
  checkRequiredFiles();
  checkManifest();
  checkJavaScriptSyntax();
  checkLocalModuleImports();
  checkFirebaseModuleImportValidity();
  checkServiceWorkerPrecache();
  checkDuplicateIds();
  checkLocalAssetReferences();
  checkV2Isolation();
  await checkMembersModuleBehavior();
  await checkGarageModuleBehavior();
  checkProtectedProductionFilesUnchanged();

  if (errors.length) {
    console.error("V2 validation failed with the following issues:\n");
    errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error}`);
    });
    process.exit(1);
  }

  console.log("ONI HUB v2 foundation validation OK");
}

await run();
