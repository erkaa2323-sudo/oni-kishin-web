import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

function assertFile(file) {
  assert(exists(file), `Missing required file: ${file}`);
}

function checkRequiredFiles() {
  const required = [
    "index.html",
    "offline.html",
    "manifest.webmanifest",
    "sw.js",
    "css/tokens.css",
    "css/app.css",
    "css/components.css",
    "js/app.js",
    "js/router.js",
    "js/firebase.js",
    "js/auth.js",
    "js/members.js",
    "js/garage.js",
    "js/music.js",
    "js/meet.js",
    "js/market.js",
    "js/oni-ai.js",
    "admin/index.html",
    "worker/index.js",
    "legacy/index-v1.html",
    "firestore.rules",
    "src/index.js",
    "src/secure-worker.js",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png",
    "icons/apple-touch-icon.png"
  ];

  required.forEach(assertFile);
}

function checkManifest() {
  let manifest;
  try {
    manifest = JSON.parse(read("manifest.webmanifest"));
  } catch (error) {
    assert(false, `manifest.webmanifest invalid JSON: ${error.message}`);
    return;
  }

  const mustBeStrings = ["name", "short_name", "id", "start_url", "scope", "display", "theme_color", "background_color"];
  mustBeStrings.forEach(key => assert(typeof manifest[key] === "string" && manifest[key].length > 0, `Manifest missing/invalid: ${key}`));

  assert(manifest.id === "/oni-kishin-web/", "Manifest id must stay /oni-kishin-web/");
  assert(manifest.start_url === "/oni-kishin-web/", "Manifest start_url must stay /oni-kishin-web/");
  assert(manifest.scope === "/oni-kishin-web/", "Manifest scope must stay /oni-kishin-web/");
  assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, "Manifest icons must be a non-empty array");

  for (const icon of Array.isArray(manifest.icons) ? manifest.icons : []) {
    assert(typeof icon.src === "string" && icon.src.length > 0, "Manifest icon src missing");
    if (typeof icon.src === "string") {
      assert(exists(icon.src), `Manifest icon missing file: ${icon.src}`);
    }
  }
}

function checkJavaScriptSyntax() {
  const files = [
    "sw.js",
    "worker/index.js",
    "src/index.js",
    "src/secure-worker.js",
    ...fs.readdirSync(path.join(root, "js")).filter(name => name.endsWith(".js")).map(name => `js/${name}`)
  ];

  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    if (result.status !== 0) {
      errors.push(`JS syntax failed: ${file}\n${(result.stderr || result.stdout || "").trim()}`);
    }
  }
}

function checkLocalModuleImports() {
  const jsFiles = fs.readdirSync(path.join(root, "js"))
    .filter(name => name.endsWith(".js"))
    .map(name => `js/${name}`)
    .concat(["worker/index.js", "src/secure-worker.js"]);

  const importRegex = /import\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g;

  for (const file of jsFiles) {
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

function checkServiceWorkerPrecache() {
  const sw = read("sw.js");
  const entries = [...sw.matchAll(/BASE\s*\+\s*"([^"]+)"/g)].map(m => m[1]);
  const unique = [...new Set(entries)];

  for (const rel of unique) {
    assert(exists(rel), `sw.js precache references missing file: ${rel}`);
  }
}

function checkDuplicateIds() {
  const htmlFiles = ["index.html", "admin/index.html", "offline.html"];
  const idRegex = /\sid=["']([^"']+)["']/g;

  for (const file of htmlFiles) {
    const ids = new Map();
    const content = read(file);

    for (const match of content.matchAll(idRegex)) {
      const id = match[1];
      ids.set(id, (ids.get(id) || 0) + 1);
    }

    for (const [id, count] of ids.entries()) {
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
  const resolved = path.posix.normalize(path.posix.join(fromDir, value));
  return resolved.replace(/^\.\//, "");
}

function checkLocalAssetReferences() {
  const htmlFiles = ["index.html", "admin/index.html", "offline.html"];
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

function checkLegacyFirestoreContracts() {
  const legacy = read("legacy/index-v1.html");
  const rules = read("firestore.rules");

  const payloadChecks = [
    "addDoc(collection(db,\"applications\"),{",
    "addDoc(collection(db,\"orders\"),{",
    "setDoc(doc(db,\"meetParticipants\",k),{"
  ];

  payloadChecks.forEach(fragment => assert(legacy.includes(fragment), `legacy/index-v1.html missing payload fragment: ${fragment}`));

  const ruleKeys = [
    '"last"', '"first"', '"age"', '"gender"', '"cpmid"', '"nick"', '"direction"', '"contactType"', '"contact"', '"experience"', '"message"', '"status"',
    '"orderNo"', '"productId"', '"productName"', '"unitPrice"', '"quantity"', '"total"', '"cpmNick"', '"cpmId"',
    '"meetId"', '"meetStartAt"', '"memberId"', '"name"', '"source"'
  ];

  ruleKeys.forEach(key => assert(rules.includes(key), `firestore.rules missing expected key: ${key}`));
}

function run() {
  checkRequiredFiles();
  checkManifest();
  checkJavaScriptSyntax();
  checkLocalModuleImports();
  checkServiceWorkerPrecache();
  checkDuplicateIds();
  checkLocalAssetReferences();
  checkLegacyFirestoreContracts();

  if (errors.length > 0) {
    console.error("Validation failed with the following issues:\n");
    errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error}`);
    });
    process.exit(1);
  }

  console.log("ONI HUB v2 foundation validation OK");
}

run();
