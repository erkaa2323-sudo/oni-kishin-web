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
    "v2/js/admin.js",
    "v2/js/members.js",
    "v2/js/garage.js",
    "v2/js/music.js",
    "v2/js/meet.js",
    "v2/js/join.js",
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

function compileGarageValidationExports({ docs = [], getDocsImpl } = {}) {
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
      Element: class Element {},
      HTMLElement: class HTMLElement {},
      HTMLSelectElement: class HTMLSelectElement {},
      HTMLImageElement: class HTMLImageElement {},
      collection: (_, name) => {
        collections.push(name);
        return { name };
      },
      getFirestoreDb: () => ({}),
      getDocs: async (...args) => {
        getDocsCalls += 1;
        if (typeof getDocsImpl === "function") {
          return getDocsImpl(...args);
        }
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
      Element: context.Element,
      HTMLElement: context.HTMLElement,
      HTMLSelectElement: context.HTMLSelectElement,
      getDocsCalls: () => getDocsCalls,
      collections: () => collections.slice()
    };
  }

function createFakeGarageRoot(ElementCtor, HTMLElementCtor, HTMLSelectElementCtor) {
    class FakeNode extends ElementCtor {
      constructor() {
        super();
        this.value = "";
        this.textContent = "";
        this.innerHTML = "";
        this.listeners = new Map();
      }
      addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
      }
      removeEventListener(type, handler) {
        const set = this.listeners.get(type);
        if (!set) return;
        set.delete(handler);
        if (!set.size) this.listeners.delete(type);
      }
      querySelector() {
        return null;
      }
      listenerCount(type) {
        return this.listeners.get(type)?.size || 0;
      }
      trigger(type, event = {}) {
        const set = this.listeners.get(type);
        if (!set) return;
        for (const handler of [...set]) {
          handler(event);
        }
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
      node(selector) {
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
      Element,
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
    const root = createFakeGarageRoot(Element, HTMLElement, HTMLSelectElement);
    module.mount(root);
    module.mount(root);
    await Promise.resolve();
    await Promise.resolve();

    assert(getDocsCalls() === 1, "Garage route must mount once and avoid duplicate collection reads");
    assert(collections().includes("garage"), "Garage route must read from the Firestore garage collection");

    let callIndex = 0;
    const failingDocs = compileGarageValidationExports({
      docs: sampleDocs,
      getDocsImpl: async () => {
        callIndex += 1;
        if (callIndex <= 3) throw new Error("forced garage read error");
        return {
          docs: sampleDocs.map(item => ({
            id: item.id,
            data: () => item.data
          }))
        };
      }
    });

    const flakyGarage = failingDocs.exports.createGarageModule();
    const flakyRoot = createFakeGarageRoot(
      failingDocs.Element,
      failingDocs.HTMLElement,
      failingDocs.HTMLSelectElement
    );
    flakyGarage.mount(flakyRoot);
    await Promise.resolve();
    await Promise.resolve();

    const flakyGrid = flakyRoot.node("[data-garage-grid]");
    assert(flakyGrid?.listenerCount("click") === 1, "Garage inline retry listener must be delegated once");

    const inlineRetryTarget = new failingDocs.Element();
    inlineRetryTarget.closest = function (selector) {
      return selector === "[data-garage-inline-retry]" ? this : null;
    };
    flakyGrid.trigger("click", { target: inlineRetryTarget });
    flakyGrid.trigger("click", { target: inlineRetryTarget });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert(failingDocs.getDocsCalls() >= 3, "Garage retry clicks must trigger new read attempts");
    assert(flakyGrid?.listenerCount("click") === 1, "Garage retry delegation must not accumulate listeners after error cycles");

    flakyGarage.unmount();
    assert(flakyGrid?.listenerCount("click") === 0, "Garage delegated retry listener must be cleaned up on unmount");

    flakyGarage.mount(flakyRoot);
    await Promise.resolve();
    await Promise.resolve();
    assert(flakyGrid?.listenerCount("click") === 1, "Garage delegated retry listener must be reattached once on remount");
  }

  function createBaseFakeNodeClasses() {
    class Element {
      constructor() {
        this.listeners = new Map();
        this.dataset = {};
        this.value = "";
        this.textContent = "";
        this.innerHTML = "";
        this.disabled = false;
      }
      addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
      }
      removeEventListener(type, handler) {
        const handlers = this.listeners.get(type);
        if (!handlers) return;
        handlers.delete(handler);
        if (!handlers.size) this.listeners.delete(type);
      }
      trigger(type, event = {}) {
        const handlers = this.listeners.get(type);
        if (!handlers) return;
        for (const handler of [...handlers]) handler(event);
      }
      listenerCount(type) {
        return this.listeners.get(type)?.size || 0;
      }
      closest() {
        return null;
      }
    }

    class HTMLElement extends Element {}
    class HTMLButtonElement extends HTMLElement {}
    class HTMLInputElement extends HTMLElement {}
    class HTMLTextAreaElement extends HTMLElement {}
    class HTMLSelectElement extends HTMLElement {}
    class HTMLFormElement extends HTMLElement {
      reset() {}
    }

    return {
      Element,
      HTMLElement,
      HTMLButtonElement,
      HTMLInputElement,
      HTMLTextAreaElement,
      HTMLSelectElement,
      HTMLFormElement
    };
  }

  function compileMeetValidationExports({
    membersDocs = [],
    meetDoc = null,
    participantDocs = [],
    getDocsImpl,
    runTransactionImpl,
    onSnapshotImpl
  } = {}) {
    const source = read("v2/js/meet.js");
    const transformed = source
      .replace(/import[\s\S]*?from\s+["'][^"']+["'];\s*/g, "")
      .replace(/export function\s+/g, "function ")
      + "\nmodule.exports = { createMeetModule, normalizeMeetRecord, normalizeMeetParticipant, parseTimestampMs, getMeetState, formatCountdown, meetRouteMarkup };";

    const klasses = createBaseFakeNodeClasses();
    const snapshotUnsubs = [];
    const intervalHandles = [];
    const store = new Map();
    const snapshotCallKinds = new Map();
    let activeSubscriptions = 0;
    let nextIntervalId = 1;
    let activeIntervalCount = 0;
    let getDocsCalls = 0;
    let onSnapshotCalls = 0;
    let runTransactionCalls = 0;
    let transactionSetCalls = 0;
    let txnQueue = Promise.resolve();

    if (meetDoc) {
      store.set("meets/current", { ...(meetDoc || {}) });
    }
    for (const item of participantDocs) {
      store.set(`meetParticipants/${item.id}`, { ...(item.data || {}) });
    }

    function asDoc(data, id) {
      return {
        id,
        data: () => data
      };
    }

    function refKey(ref) {
      return `${ref.name}/${ref.id}`;
    }

    function snapshotFromRef(ref) {
      const value = store.get(refKey(ref));
      return {
        exists: () => value != null,
        id: ref.id,
        data: () => (value ? { ...value } : {})
      };
    }

    function emitDefaultSnapshot(ref, next, error) {
      if (ref?.kind === "doc" && ref.name === "meets") {
        const snap = snapshotFromRef(ref);
        try { next(snap); } catch (err) { error?.(err); }
        return;
      }
      if (ref?.kind === "collection" && ref.name === "members") {
        try { next({ docs: membersDocs.map(item => asDoc(item.data, item.id)) }); } catch (err) { error?.(err); }
        return;
      }
      if (ref?.kind === "query") {
        const docs = [...store.entries()]
          .filter(([key]) => key.startsWith("meetParticipants/"))
          .map(([key, data]) => asDoc(data, key.split("/")[1]));
        try { next({ docs }); } catch (err) { error?.(err); }
      }
    }

    function makeUnsub() {
      activeSubscriptions += 1;
      const unsub = () => {
        if (unsub.called) return;
        unsub.called = true;
        activeSubscriptions = Math.max(0, activeSubscriptions - 1);
      };
      unsub.called = false;
      snapshotUnsubs.push(unsub);
      return unsub;
    }

    const context = {
      module: { exports: {} },
      exports: {},
      console,
      Math,
      Date,
      navigator: { clipboard: { writeText: async () => {} } },
      localStorage: {
        map: new Map(),
        getItem(key) { return this.map.has(key) ? this.map.get(key) : null; },
        setItem(key, value) { this.map.set(key, String(value)); },
        removeItem(key) { this.map.delete(key); }
      },
      ...klasses,
      setInterval(handler) {
        const id = nextIntervalId++;
        intervalHandles.push({ id, handler, active: true });
        activeIntervalCount += 1;
        return id;
      },
      clearInterval(id) {
        const handle = intervalHandles.find(item => item.id === id && item.active);
        if (!handle) return;
        handle.active = false;
        activeIntervalCount = Math.max(0, activeIntervalCount - 1);
      },
      collection: (_, name) => ({ kind: "collection", name }),
      doc: (_, name, id) => ({ kind: "doc", name, id }),
      where: (field, op, value) => ({ field, op, value }),
      query: (...parts) => ({ kind: "query", parts }),
      getFirestoreDb: () => ({}),
      serverTimestamp: () => ({ __kind: "serverTimestamp" }),
      getDocs: async queryRef => {
        getDocsCalls += 1;
        if (typeof getDocsImpl === "function") return getDocsImpl(queryRef);
        if (queryRef?.kind === "query") {
          const whereMeetId = queryRef.parts.find(part => part?.field === "meetId");
          const docs = [...store.entries()]
            .filter(([key, data]) => key.startsWith("meetParticipants/"))
            .filter(([, data]) => !whereMeetId || data?.meetId === whereMeetId.value)
            .map(([key, data]) => asDoc(data, key.split("/")[1]));
          return { docs };
        }
        return { docs: [] };
      },
      runTransaction: async (db, updater) => {
        runTransactionCalls += 1;
        if (typeof runTransactionImpl === "function") {
          return runTransactionImpl(db, updater, { store, snapshotFromRef, refKey });
        }
        const execute = async () => {
          const pendingWrites = [];
          const transaction = {
            get: async ref => snapshotFromRef(ref),
            set: (ref, data, options = {}) => {
              pendingWrites.push({ ref, data, options });
            }
          };
          const result = await updater(transaction);
          for (const write of pendingWrites) {
            transactionSetCalls += 1;
            const key = refKey(write.ref);
            const before = store.get(key) || {};
            store.set(key, write.options?.merge ? { ...before, ...write.data } : { ...write.data });
          }
          return result;
        };
        const queued = txnQueue.then(execute, execute);
        txnQueue = queued.then(() => {}, () => {});
        return queued;
      },
      onSnapshot(ref, next, error) {
        onSnapshotCalls += 1;
        const kind = ref?.kind === "doc"
          ? `doc:${ref.name}`
          : ref?.kind === "collection"
            ? `collection:${ref.name}`
            : "query";
        snapshotCallKinds.set(kind, (snapshotCallKinds.get(kind) || 0) + 1);
        const unsub = makeUnsub();
        if (typeof onSnapshotImpl === "function") {
          onSnapshotImpl({
            ref,
            next,
            error,
            emitDefault: () => emitDefaultSnapshot(ref, next, error),
            store,
            unsub
          });
          return unsub;
        }
        emitDefaultSnapshot(ref, next, error);
        return unsub;
      }
    };

    vm.runInNewContext(transformed, context, { filename: "v2/js/meet.js" });
    return {
      exports: context.module.exports,
      classes: klasses,
      getRunTransactionCalls: () => runTransactionCalls,
      getTransactionSetCalls: () => transactionSetCalls,
      getGetDocsCalls: () => getDocsCalls,
      getOnSnapshotCalls: () => onSnapshotCalls,
      getSnapshotCallKinds: () => new Map(snapshotCallKinds),
      getActiveIntervals: () => activeIntervalCount,
      getActiveSubscriptions: () => activeSubscriptions,
      getStoredParticipants: () => [...store.entries()]
        .filter(([key]) => key.startsWith("meetParticipants/"))
        .map(([key, data]) => ({ id: key.split("/")[1], data: { ...data } })),
      getUnsubs: () => snapshotUnsubs
    };
  }

  function createFakeMeetRoot(classes) {
    const {
      HTMLElement,
      HTMLButtonElement,
      HTMLInputElement,
      HTMLFormElement
    } = classes;

    class FakeRoot extends HTMLElement {
      constructor() {
        super();
        this.innerHTML = "";
        this.nodes = new Map();

        const node = (selector, value) => {
          this.nodes.set(selector, value);
          return value;
        };

        node("[data-meet-state-pill]", new HTMLElement());
        node("[data-meet-title]", new HTMLElement());
        node("[data-meet-room-label]", new HTMLElement());
        node("[data-meet-countdown-label]", new HTMLElement());
        node("[data-meet-countdown]", new HTMLElement());
        node("[data-meet-start]", new HTMLElement());
        node("[data-meet-end]", new HTMLElement());
        node("[data-meet-capacity]", new HTMLElement());
        node("[data-meet-participants-count]", new HTMLElement());
        node("[data-meet-room-id]", new HTMLElement());
        node("[data-meet-password]", new HTMLElement());
        node("[data-meet-participant-list]", new HTMLElement());
        node("[data-meet-registration-state]", new HTMLElement());
        node("[data-meet-error]", new HTMLElement());

        const form = new HTMLFormElement();
        form.reset = () => {
          const nick = this.nodes.get("[data-meet-nick]");
          const cpm = this.nodes.get("[data-meet-cpm]");
          if (nick) nick.value = "";
          if (cpm) cpm.value = "";
        };
        node("[data-meet-form]", form);
        node("[data-meet-retry]", new HTMLButtonElement());
        node("[data-meet-join]", new HTMLButtonElement());
        node("[data-meet-nick]", new HTMLInputElement());
        node("[data-meet-cpm]", new HTMLInputElement());
      }

      querySelector(selector) {
        return this.nodes.get(selector) || null;
      }

      node(selector) {
        return this.nodes.get(selector) || null;
      }
    }

    return new FakeRoot();
  }

  function compileJoinValidationExports({
    addDocImpl,
    getDocsImpl
  } = {}) {
    const source = read("v2/js/join.js");
    const transformed = source
      .replace(/import[\s\S]*?from\s+["'][^"']+["'];\s*/g, "")
      .replace(/export function\s+/g, "function ")
      + "\nmodule.exports = { createJoinModule, normalizeApplicationRecord, normalizeJoinDraft, validateJoinDraft, buildApplicationPayload, joinRouteMarkup };";

    const klasses = createBaseFakeNodeClasses();
    let addDocCalls = 0;
    let getDocsCalls = 0;

    const context = {
      module: { exports: {} },
      exports: {},
      console,
      Math,
      Date,
      ...klasses,
      localStorage: {
        map: new Map(),
        getItem(key) { return this.map.has(key) ? this.map.get(key) : null; },
        setItem(key, value) { this.map.set(key, String(value)); },
        removeItem(key) { this.map.delete(key); }
      },
      collection: (_, name) => ({ kind: "collection", name }),
      where: (field, op, value) => ({ field, op, value }),
      query: (...parts) => ({ kind: "query", parts }),
      limit: value => ({ limit: value }),
      getFirestoreDb: () => ({}),
      serverTimestamp: () => ({ __kind: "serverTimestamp" }),
      getDocs: async (...args) => {
        getDocsCalls += 1;
        if (typeof getDocsImpl === "function") return getDocsImpl(...args);
        return { docs: [] };
      },
      addDoc: async (...args) => {
        addDocCalls += 1;
        if (typeof addDocImpl === "function") return addDocImpl(...args);
        return { id: "new-app" };
      }
    };

    vm.runInNewContext(transformed, context, { filename: "v2/js/join.js" });
    return {
      exports: context.module.exports,
      classes: klasses,
      getAddDocCalls: () => addDocCalls,
      getGetDocsCalls: () => getDocsCalls
    };
  }

  function createFakeJoinRoot(classes) {
    const {
      HTMLElement,
      HTMLInputElement,
      HTMLSelectElement,
      HTMLTextAreaElement,
      HTMLButtonElement,
      HTMLFormElement
    } = classes;

    class FakeRoot extends HTMLElement {
      constructor() {
        super();
        this.innerHTML = "";
        this.nodes = new Map();

        const field = (name, node) => {
          this.nodes.set(`[data-join-field="${name}"]`, node);
          return node;
        };

        field("first", new HTMLInputElement());
        field("last", new HTMLInputElement());
        field("age", new HTMLInputElement());
        field("gender", new HTMLSelectElement());
        field("cpmid", new HTMLInputElement());
        field("nick", new HTMLInputElement());
        field("direction", new HTMLSelectElement());
        field("contactType", new HTMLSelectElement());
        field("contact", new HTMLInputElement());
        field("experience", new HTMLSelectElement());
        field("message", new HTMLTextAreaElement());

        this.nodes.set("[data-join-state]", new HTMLElement());
        this.nodes.set("[data-join-error]", new HTMLElement());
        this.nodes.set("[data-join-submit]", new HTMLButtonElement());
        this.nodes.set("[data-join-reset]", new HTMLButtonElement());

        const form = new HTMLFormElement();
        form.reset = () => {
          for (const [selector, node] of this.nodes.entries()) {
            if (!selector.startsWith("[data-join-field=")) continue;
            node.value = "";
          }
        };
        this.nodes.set("[data-join-form]", form);
      }
      querySelector(selector) {
        return this.nodes.get(selector) || null;
      }
      node(selector) {
        return this.nodes.get(selector) || null;
      }
    }

    return new FakeRoot();
  }

  async function checkMeetModuleBehavior() {
    const currentMeetDoc = {
      name: "ONI NIGHT MEET",
      roomLabel: "ONI & KISHIN · CPM 1",
      startAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      durationMinutes: 20,
      roomId: "ROOM-88",
      password: "PASS-88",
      maxPlayers: 20,
      enabled: true
    };
    const membersDocs = [{ id: "m1", data: { nick: "Kitsune", cpmid: "ONI0001" } }];
    const participantDocs = [{ id: "__counter__", data: { meetId: "current" } }];

    const validation = compileMeetValidationExports({
      meetDoc: currentMeetDoc,
      membersDocs,
      participantDocs,
      getDocsImpl: async () => ({ docs: [] })
    });

    const {
      normalizeMeetRecord,
      normalizeMeetParticipant,
      parseTimestampMs,
      getMeetState,
      formatCountdown,
      meetRouteMarkup,
      createMeetModule
    } = validation.exports;

    assert(typeof createMeetModule === "function", "v2/js/meet.js must export createMeetModule()");
    assert(typeof normalizeMeetRecord === "function", "v2/js/meet.js must export normalizeMeetRecord()");
    assert(typeof normalizeMeetParticipant === "function", "v2/js/meet.js must export normalizeMeetParticipant()");
    assert(typeof parseTimestampMs === "function", "v2/js/meet.js must export parseTimestampMs()");
    assert(typeof getMeetState === "function", "v2/js/meet.js must export getMeetState()");
    assert(typeof formatCountdown === "function", "v2/js/meet.js must export formatCountdown()");
    assert(typeof meetRouteMarkup === "function", "v2/js/meet.js must export meetRouteMarkup()");

    const current = normalizeMeetRecord(currentMeetDoc, "current");
    assert(current.roomId === "ROOM-88", "Meet current schema normalization must preserve roomId");
    assert(current.password === "PASS-88", "Meet current schema normalization must preserve password");

    const legacy = normalizeMeetRecord({
      meetName: "LEGACY MEET",
      start: { seconds: 2_000_000_000 },
      pass: "LEGACY-PASS",
      roomCode: "LEGACY-ID",
      duration: 15,
      maxParticipants: 8,
      active: true
    }, "current");
    assert(legacy.title === "LEGACY MEET", "Meet legacy schema normalization must map legacy name field");
    assert(legacy.password === "LEGACY-PASS", "Meet legacy schema normalization must map legacy pass field");
    assert(legacy.roomId === "LEGACY-ID", "Meet legacy schema normalization must map legacy room identifier");
    assert(legacy.maxPlayers === 8, "Meet legacy schema normalization must map legacy participant limit");

    const missing = normalizeMeetRecord({}, "current");
    assert(missing.maxPlayers >= 1, "Meet normalization must provide fallback max players");
    assert(Number.isNaN(missing.startAtMs), "Malformed meet records must not create fake start timestamps");

    const normalizedParticipant = normalizeMeetParticipant({ nick: "Alpha", cpmid: "CPM-1", meetStartAt: { seconds: 123 } }, "p-1");
    assert(normalizedParticipant.cpmId === "CPM-1", "Meet participant normalization must support legacy cpmid field");

    const startMs = Date.now() + 60_000;
    const activeMeet = { enabled: true, startAtMs: startMs - 30_000, endAtMs: startMs + 30_000 };
    assert(getMeetState({ enabled: true, startAtMs: startMs, endAtMs: startMs + 60_000 }, startMs - 1) === "upcoming", "Meet state must detect upcoming state");
    assert(getMeetState(activeMeet, startMs) === "active", "Meet state must detect active state");
    assert(getMeetState(activeMeet, startMs + 31_000) === "expired", "Meet state must detect expired state");
    assert(formatCountdown(-1000) === "00:00:00", "Meet countdown must never show negative values");
    assert(formatCountdown(3700_000).startsWith("01:01"), "Meet countdown should format absolute remaining time");

    const routeMarkup = meetRouteMarkup();
    assert(routeMarkup.includes("data-meet-form"), "Meet route markup must include registration form");

    const registerValidation = compileMeetValidationExports({
      meetDoc: { ...currentMeetDoc, startAt: new Date(Date.now() - 60_000).toISOString() },
      membersDocs,
      participantDocs: [],
      getDocsImpl: async () => ({ docs: [] })
    });

    const meetModule = registerValidation.exports.createMeetModule();
    const meetRoot = createFakeMeetRoot(registerValidation.classes);
    meetRoot.node("[data-meet-nick]").value = "Kitsune";
    meetRoot.node("[data-meet-cpm]").value = "ONI0001";
    meetModule.mount(meetRoot);
    meetModule.mount(meetRoot);

    const form = meetRoot.node("[data-meet-form]");
    const event = { preventDefault() {} };
    form.trigger("submit", event);
    form.trigger("submit", event);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert(registerValidation.getRunTransactionCalls() <= 1, "Meet registration must block duplicate/double-tap writes");
    assert(registerValidation.getTransactionSetCalls() <= 2, "Meet duplicate submit must not create duplicate participant writes");
    assert(registerValidation.getOnSnapshotCalls() >= 2, "Meet module must subscribe to meet and member/participant snapshots");
    assert(registerValidation.getActiveIntervals() === 1, "Meet module must keep a single active timer");

    meetModule.unmount();
    assert(registerValidation.getActiveIntervals() === 0, "Meet module must cleanup timer on unmount");
    assert(registerValidation.getUnsubs().every(unsub => unsub.called), "Meet module must cleanup snapshot listeners on unmount");

    const concurrencyValidation = compileMeetValidationExports({
      meetDoc: {
        ...currentMeetDoc,
        startAt: new Date(Date.now() - 60_000).toISOString(),
        maxPlayers: 1
      },
      membersDocs: [
        { id: "m1", data: { nick: "Kitsune", cpmid: "ONI0001" } },
        { id: "m2", data: { nick: "Noir", cpmid: "ONI0002" } }
      ],
      participantDocs: []
    });

    const clientA = concurrencyValidation.exports.createMeetModule();
    const clientB = concurrencyValidation.exports.createMeetModule();
    const rootA = createFakeMeetRoot(concurrencyValidation.classes);
    const rootB = createFakeMeetRoot(concurrencyValidation.classes);
    clientA.mount(rootA);
    clientB.mount(rootB);
    rootA.node("[data-meet-nick]").value = "Kitsune";
    rootA.node("[data-meet-cpm]").value = "ONI0001";
    rootB.node("[data-meet-nick]").value = "Noir";
    rootB.node("[data-meet-cpm]").value = "ONI0002";
    rootA.node("[data-meet-form]").trigger("submit", event);
    rootB.node("[data-meet-form]").trigger("submit", event);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const participantWrites = concurrencyValidation.getStoredParticipants()
      .filter(item => item.id !== "__counter__")
      .filter(item => item.data.meetId === "current");
    assert(participantWrites.length <= 1, "Meet concurrency control must prevent two clients taking the final slot");

    clientA.unmount();
    clientB.unmount();

    let forceMeetFailure = true;
    const retryValidation = compileMeetValidationExports({
      meetDoc: { ...currentMeetDoc, startAt: new Date(Date.now() - 60_000).toISOString() },
      membersDocs,
      participantDocs: [],
      onSnapshotImpl: ({ ref, error, emitDefault }) => {
        if (ref?.kind === "doc" && ref.name === "meets" && forceMeetFailure) {
          forceMeetFailure = false;
          error?.(new Error("forced meet listener failure"));
          return;
        }
        emitDefault();
      }
    });
    const retryModule = retryValidation.exports.createMeetModule();
    const retryRoot = createFakeMeetRoot(retryValidation.classes);
    retryModule.mount(retryRoot);
    const retryBtn = retryRoot.node("[data-meet-retry]");
    const beforeRetryCalls = retryValidation.getOnSnapshotCalls();
    retryBtn.trigger("click");
    await Promise.resolve();
    await Promise.resolve();
    const afterRetryCalls = retryValidation.getOnSnapshotCalls();
    assert(afterRetryCalls > beforeRetryCalls, "Meet retry must reconnect Firestore listeners after subscription failure");
    assert(retryValidation.getActiveIntervals() === 1, "Meet retry must not create duplicate timers");

    const callsAfterFirstRetry = retryValidation.getOnSnapshotCalls();
    retryBtn.trigger("click");
    retryBtn.trigger("click");
    await Promise.resolve();
    await Promise.resolve();
    assert(retryValidation.getOnSnapshotCalls() > callsAfterFirstRetry, "Meet repeated retry clicks must reconnect listeners");
    assert(retryValidation.getActiveIntervals() === 1, "Meet repeated retry clicks must keep a single active timer");
    assert(retryValidation.getActiveSubscriptions() <= 3, "Meet retry must keep one active listener set without duplicates");
    retryModule.unmount();
  }

  async function checkJoinModuleBehavior() {
    const flush = async (cycles = 8) => {
      for (let i = 0; i < cycles; i += 1) {
        await Promise.resolve();
      }
    };
    const validation = compileJoinValidationExports();
    const {
      createJoinModule,
      normalizeApplicationRecord,
      normalizeJoinDraft,
      validateJoinDraft,
      buildApplicationPayload,
      joinRouteMarkup
    } = validation.exports;

    assert(typeof createJoinModule === "function", "v2/js/join.js must export createJoinModule()");
    assert(typeof normalizeApplicationRecord === "function", "v2/js/join.js must export normalizeApplicationRecord()");
    assert(typeof normalizeJoinDraft === "function", "v2/js/join.js must export normalizeJoinDraft()");
    assert(typeof validateJoinDraft === "function", "v2/js/join.js must export validateJoinDraft()");
    assert(typeof buildApplicationPayload === "function", "v2/js/join.js must export buildApplicationPayload()");
    assert(typeof joinRouteMarkup === "function", "v2/js/join.js must export joinRouteMarkup()");

    const current = normalizeApplicationRecord({ first: "A", last: "B", nick: "K", cpmid: "CPM-1", status: "Шинэ" }, "1");
    assert(current.firstName === "A", "Join current schema normalization must keep first field");
    assert(current.cpmId === "CPM-1", "Join current schema normalization must keep cpmid field");

    const legacy = normalizeApplicationRecord({ firstName: "L", lastName: "G", nickname: "Old", cpmId: "LEG-1" }, "2");
    assert(legacy.firstName === "L", "Join legacy normalization must map firstName");
    assert(legacy.nickname === "Old", "Join legacy normalization must map nickname");

    const draft = normalizeJoinDraft({
      first: " First ",
      last: " Last ",
      age: "19",
      gender: "Эрэгтэй",
      cpmid: " oni-7 ",
      nick: " Kitsune ",
      direction: "Clean Car",
      contactType: "Instagram",
      contact: "@oni",
      experience: "1 – 2 жил",
      message: "hello"
    });
    assert(draft.cpmid === "ONI-7", "Join draft normalization must uppercase CPM ID");

    const invalid = validateJoinDraft(normalizeJoinDraft({}));
    assert(!invalid.valid, "Join validation must reject missing required fields");

    const wsInvalid = validateJoinDraft(normalizeJoinDraft({
      first: "   ",
      last: "   ",
      age: "19",
      gender: "Эрэгтэй",
      cpmid: "  ",
      nick: "  ",
      direction: "",
      contactType: "",
      contact: " ",
      experience: ""
    }));
    assert(!wsInvalid.valid, "Join validation must reject whitespace-only values");

    const cpmInvalid = validateJoinDraft(normalizeJoinDraft({
      first: "A",
      last: "B",
      age: "19",
      gender: "Эрэгтэй",
      cpmid: "A",
      nick: "Nick",
      direction: "Clean Car",
      contactType: "Instagram",
      contact: "@x",
      experience: "6 сараас бага"
    }));
    assert(!cpmInvalid.valid, "Join validation must enforce CPM ID compatibility length rules");

    const payload = buildApplicationPayload(draft);
    assert(payload.status === "Шинэ", "Join payload must preserve default application status");
    assert(payload.firstName === draft.first && payload.lastName === draft.last, "Join payload must preserve admin-compatible legacy aliases");
    assert(payload.cpmid === payload.cpmId, "Join payload must include both cpmid and cpmId fields");

    assert(joinRouteMarkup().includes("data-join-form"), "Join route markup must include application form");

    let shouldFailFirstSubmit = true;
    const moduleValidation = compileJoinValidationExports({
      getDocsImpl: async () => ({ docs: [] }),
      addDocImpl: async () => {
        if (shouldFailFirstSubmit) {
          shouldFailFirstSubmit = false;
          throw new Error("forced write failure");
        }
        return { id: "new-application" };
      }
    });
    const joinModule = moduleValidation.exports.createJoinModule();
    const joinRoot = createFakeJoinRoot(moduleValidation.classes);
    joinModule.mount(joinRoot);
    joinModule.mount(joinRoot);

    const set = (name, value) => {
      const node = joinRoot.node(`[data-join-field="${name}"]`);
      if (node) node.value = value;
    };
    set("first", "Erkaa");
    set("last", "Sudo");
    set("age", "21");
    set("gender", "Эрэгтэй");
    set("cpmid", "ONI001");
    set("nick", "Kitsune");
    set("direction", "Clean Car");
    set("contactType", "Instagram");
    set("contact", "@oni");
    set("experience", "1 – 2 жил");
    set("message", "Ready");

    const submitEvent = { preventDefault() {} };
    const form = joinRoot.node("[data-join-form]");

    form.trigger("submit", submitEvent);
    form.trigger("submit", submitEvent);
    await flush();
    assert(moduleValidation.getAddDocCalls() === 1, "Join must allow one Firestore write per intentional submit action");

    form.trigger("submit", submitEvent);
    await flush();
    assert(
      moduleValidation.getAddDocCalls() >= 1 && moduleValidation.getAddDocCalls() <= 2,
      "Join retry flow must avoid duplicate rapid writes"
    );

    const submitButton = joinRoot.node("[data-join-submit]");
    if (moduleValidation.getAddDocCalls() === 2) {
      assert(submitButton?.disabled === true, "Join submit button must lock after successful submission to prevent immediate duplicate resubmits");
    }

    joinModule.unmount();
    const resetButton = joinRoot.node("[data-join-reset]");
    assert(resetButton?.listenerCount("click") === 0, "Join module must cleanup listeners on unmount");

    joinModule.mount(joinRoot);
    assert(resetButton?.listenerCount("click") === 1, "Join module must rebind listeners exactly once on remount");
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
  const v2Router = read("v2/js/router.js");
  const v2Sw = read("v2/sw.js");

  assert(v2Index.includes("./manifest.webmanifest"), "v2/index.html must link v2 manifest");
  assert(v2Index.includes('data-route="join"'), "v2/index.html must expose JOIN navigation route");
  assert(v2App.includes('from "./join.js"'), "v2/js/app.js must integrate join module import");
  assert(v2Router.includes('"join"'), "v2/js/router.js must allow join route navigation");
  assert(v2Sw.includes('BASE + "js/join.js"'), "v2/sw.js must precache join module");
  assert(v2App.includes('const BASE = "/oni-kishin-web/v2/";'), "v2/js/app.js must register v2 scope only");
  assert(v2Sw.includes('const BASE = "/oni-kishin-web/v2/";'), "v2/sw.js BASE must stay /oni-kishin-web/v2/");
  assert(v2Sw.includes('url.pathname.startsWith("/oni-kishin-web/v2/")'), "v2/sw.js fetch handling must stay restricted to /v2/");
}

function checkV2AppShellContracts() {
  const v2Index = read("v2/index.html");
  const v2App = read("v2/js/app.js");
  const v2Css = read("v2/css/app.css");
  const v2Sw = read("v2/sw.js");

  assert((v2Index.match(/class="oni-shell"/g) || []).length === 1, "v2/index.html must keep a single app shell root");
  assert((v2Index.match(/class="oni-bottom-nav"/g) || []).length === 1, "v2/index.html must keep a single bottom navigation shell");
  assert(v2Index.includes('id="oniModal"'), "v2/index.html must include the app modal container");
  assert(v2Index.includes("data-modal-close"), "v2/index.html must include modal close control");

  assert(v2App.includes("target.closest(\"[data-modal-close]\")"), "v2/js/app.js must support delegated modal close interactions");
  assert(v2App.includes("target === modal"), "v2/js/app.js must allow closing modal by tapping overlay");
  assert(v2App.includes("event.key !== \"Escape\""), "v2/js/app.js must support Escape-based modal close behavior");
  assert(v2App.includes("setBodyScrollLocked(true)"), "v2/js/app.js must lock body scroll while modal is open");
  assert(v2App.includes("if (isBootstrapped) return;"), "v2/js/app.js must guard against duplicate bootstrap listeners");
  assert(v2App.includes("setupViewportHandling"), "v2/js/app.js must handle viewport/keyboard transitions");
  assert(v2App.includes("navigator.serviceWorker.register"), "v2/js/app.js must register the v2 service worker");
  assert(v2App.includes("registration.addEventListener(\"updatefound\""), "v2/js/app.js must handle service-worker update events");
  assert(v2App.includes("registration.update()"), "v2/js/app.js must re-check service-worker updates on resume/online");

  const routeCleanupCalls = (v2App.match(/clearRouteMount\(\);/g) || []).length;
  assert(routeCleanupCalls >= 6, "v2/js/app.js routes must cleanup previous route mounts before rendering next route");

  assert(v2Css.includes("body.oni-modal-open"), "v2/css/app.css must include modal-open scroll locking styles");
  assert(v2Css.includes("body.oni-keyboard-open .oni-bottom-nav"), "v2/css/app.css must prevent keyboard overlap with bottom nav");
  assert(v2Css.includes(".oni-modal[hidden]"), "v2/css/app.css must force hidden modals to not intercept touch input");

  assert(v2Sw.includes("MAX_RUNTIME_ENTRIES"), "v2/sw.js must cap runtime cache growth");
  assert(v2Sw.includes("cache: \"no-store\""), "v2/sw.js must network-refresh fast-changing assets to avoid stale cache");
}

function checkAdminModuleContracts() {
  const adminHtml = read("v2/admin/index.html");
  const adminJs = read("v2/js/admin.js");

  assert(adminHtml.includes("data-admin-auth-loading"), "v2/admin/index.html must include auth loading state");
  assert(adminHtml.includes("data-admin-auth-signed-out"), "v2/admin/index.html must include signed-out state");
  assert(adminHtml.includes("data-admin-auth-unauthorized"), "v2/admin/index.html must include unauthorized state");
  assert(adminHtml.includes("<script type=\"module\" src=\"../js/admin.js\"></script>"), "v2/admin/index.html must load v2/js/admin.js");

  assert(adminJs.includes("onAuthStateChanged"), "v2/js/admin.js must subscribe to Firebase auth state");
  assert(adminJs.includes("signInWithEmailAndPassword"), "v2/js/admin.js must support admin login");
  assert(adminJs.includes("sendPasswordResetEmail"), "v2/js/admin.js must support password reset flow");
  assert(adminJs.includes("runTransaction"), "v2/js/admin.js must use transaction-safe application approval flow");
  assert(adminJs.includes("if (state.actionLocks.has(key))"), "v2/js/admin.js must block rapid duplicate operations");
  assert(adminJs.includes("confirm(\"Энэ member-г устгах уу?\")"), "v2/js/admin.js must confirm destructive member deletes");
  assert(adminJs.includes("confirm(\"Энэ garage build-ийг устгах уу?\")"), "v2/js/admin.js must confirm destructive garage deletes");
  assert(adminJs.includes("ADMIN_EMAIL"), "v2/js/admin.js must preserve production-compatible admin identity checks");
  assert(adminJs.includes("setButtonBusy"), "v2/js/admin.js must expose per-action loading button states");
  assert(adminJs.includes("Action is already in progress."), "v2/js/admin.js must surface duplicate-action safety feedback");
}

function compileMusicValidationExports() {
  const source = read("v2/js/music.js");
  const transformed = source
    .replace(/^import\s.+?;\s*$/gm, "")
    .replace(/export function\s+/g, "function ")
    + "\nmodule.exports = { createMusicModule, startMusicIntegration, stopMusicIntegration, subscribeMusicState, getMusicSnapshot, parseMusicCommand, runMusicCommand };";

  let audioInstances = 0;
  let onSnapshotCalls = 0;
  let unsubCalls = 0;
  let snapshotHandler = null;

  class FakeAudio {
    constructor() {
      audioInstances += 1;
      this.src = "";
      this.volume = 0.72;
      this.paused = true;
      this.currentTime = 0;
      this.duration = 0;
      this.listeners = new Map();
    }
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }
    play() {
      this.paused = false;
      this.listeners.get("play")?.();
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
      this.listeners.get("pause")?.();
    }
    load() {}
    removeAttribute(name) {
      if (name === "src") this.src = "";
    }
  }

  const context = {
    module: { exports: {} },
    exports: {},
    console,
    Math,
    Date,
    setTimeout,
    clearTimeout,
    Audio: FakeAudio,
    collection: (_, name) => ({ name }),
    getFirestoreDb: () => ({}),
    onSnapshot: (_ref, next) => {
      onSnapshotCalls += 1;
      snapshotHandler = next;
      return () => { unsubCalls += 1; };
    }
  };

  vm.runInNewContext(transformed, context, { filename: "v2/js/music.js" });
  return {
    exports: context.module.exports,
    pushSnapshot(rows = []) {
      snapshotHandler?.({
        docs: rows.map(item => ({
          id: item.id,
          data: () => item.data
        }))
      });
    },
    audioInstances: () => audioInstances,
    onSnapshotCalls: () => onSnapshotCalls,
    unsubCalls: () => unsubCalls
  };
}

function checkMusicModuleBehavior() {
  const validation = compileMusicValidationExports();
  const {
    createMusicModule,
    startMusicIntegration,
    stopMusicIntegration,
    subscribeMusicState,
    getMusicSnapshot,
    parseMusicCommand,
    runMusicCommand
  } = validation.exports;

  assert(typeof createMusicModule === "function", "v2/js/music.js must export createMusicModule()");
  assert(typeof startMusicIntegration === "function", "v2/js/music.js must export startMusicIntegration()");
  assert(typeof stopMusicIntegration === "function", "v2/js/music.js must export stopMusicIntegration()");
  assert(typeof subscribeMusicState === "function", "v2/js/music.js must export subscribeMusicState()");
  assert(typeof getMusicSnapshot === "function", "v2/js/music.js must export getMusicSnapshot()");
  assert(typeof parseMusicCommand === "function", "v2/js/music.js must export parseMusicCommand()");
  assert(typeof runMusicCommand === "function", "v2/js/music.js must export runMusicCommand()");

  startMusicIntegration();
  startMusicIntegration();
  assert(validation.audioInstances() === 1, "Music integration must use a single Audio instance");
  assert(validation.onSnapshotCalls() === 1, "Music integration must avoid duplicate Firestore listeners");

  let latestSnapshot = null;
  const unsubscribe = subscribeMusicState(snapshot => { latestSnapshot = snapshot; });
  validation.pushSnapshot([
    { id: "t1", data: { title: "Track 1", artist: "ONI", file: "https://example.com/1.mp3", status: "published", order: 1 } },
    { id: "t2", data: { title: "Track 2", artist: "ONI", file: "https://example.com/2.mp3", status: "hidden", order: 2 } }
  ]);

  assert((latestSnapshot?.tracks || []).length === 1, "Music integration must expose only published playable tracks");
  assert(getMusicSnapshot().tracks.length === 1, "Music snapshot must stay in sync with Firestore updates");

  const songsCommand = parseMusicCommand("what songs are available?");
  assert(songsCommand?.type === "list", "Music parser must allow-list song listing command");
  const pauseCommand = parseMusicCommand("pause music");
  assert(pauseCommand?.type === "pause", "Music parser must allow-list pause command");
  const unknownCommand = parseMusicCommand("execute javascript alert(1)");
  assert(unknownCommand === null, "Music parser must reject non-allow-listed commands");
  assert(runMusicCommand(songsCommand).handled === true, "Music command runner must handle allow-listed commands");

  unsubscribe();
  stopMusicIntegration();
  stopMusicIntegration();
  assert(validation.unsubCalls() === 1, "Music integration must cleanup listener once when ref-count reaches zero");
}

function checkOniAiModuleContracts() {
  const source = read("v2/js/oni-ai.js");

  assert(source.includes("createOniAiModule"), "v2/js/oni-ai.js must export createOniAiModule()");
  assert(source.includes("AbortController"), "v2/js/oni-ai.js must support request cancellation");
  assert(source.includes("REQUEST_TIMEOUT_MS"), "v2/js/oni-ai.js must define request timeout handling");
  assert(source.includes("if (sending) return;"), "v2/js/oni-ai.js must block duplicate send actions");
  assert(source.includes("if (!message)"), "v2/js/oni-ai.js must reject empty messages");
  assert(source.includes("message.length > MAX_MESSAGE_CHARS"), "v2/js/oni-ai.js must reject oversize messages");
  assert(source.includes("textContent ="), "v2/js/oni-ai.js must render AI/user text safely");
  assert(source.includes("parseMusicCommand"), "v2/js/oni-ai.js must use allow-listed music command parsing");
  assert(source.includes("runMusicCommand"), "v2/js/oni-ai.js must execute only allow-listed music commands");
  assert(source.includes("requestToken += 1;"), "v2/js/oni-ai.js must invalidate stale async responses on lifecycle changes");
  assert(!source.includes("OPENAI_API_KEY"), "v2/js/oni-ai.js must not contain provider secrets");
  assert(!/innerHTML\s*=\s*[^;]*(reply|message)/i.test(source), "v2/js/oni-ai.js must not inject AI output into innerHTML");
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
  checkV2AppShellContracts();
  checkAdminModuleContracts();
  checkMusicModuleBehavior();
  checkOniAiModuleContracts();
  await checkMembersModuleBehavior();
  await checkGarageModuleBehavior();
  await checkMeetModuleBehavior();
  await checkJoinModuleBehavior();
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
