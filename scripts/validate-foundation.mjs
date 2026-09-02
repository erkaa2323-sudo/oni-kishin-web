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

function run() {
  checkRequiredFiles();
  checkManifest();
  checkJavaScriptSyntax();
  checkLocalModuleImports();
  checkServiceWorkerPrecache();
  checkDuplicateIds();
  checkLocalAssetReferences();
  checkV2Isolation();

  if (errors.length) {
    console.error("V2 validation failed with the following issues:\n");
    errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error}`);
    });
    process.exit(1);
  }

  console.log("ONI HUB v2 foundation validation OK");
}

run();
