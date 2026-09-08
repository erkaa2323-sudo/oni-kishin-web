import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

const SDK_VERSION = "5-r.5";
const ARCHIVE_URL = `https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-${SDK_VERSION}.zip`;
const ARCHIVE_SHA256 = "67064a7fb1812cf502f5c4a03bfe12cc638c75a621bb4acf06bb28763df06ba0";
const ROOT = `CubismSdkForWeb-${SDK_VERSION}`;

const CUBISM_OUTPUTS = [
  [`${ROOT}/Core/live2dcubismcore.js`, "public/vendor/live2d/live2dcubismcore.js"],
  [`${ROOT}/Core/LICENSE.md`, "public/vendor/live2d/LICENSE.md"],
  [`${ROOT}/Core/RedistributableFiles.txt`, "public/vendor/live2d/RedistributableFiles.txt"],
];

const CDN_OUTPUTS = [
  { name: "PixiJS 8.13.1", url: "https://cdn.jsdelivr.net/npm/pixi.js@8.13.1/dist/pixi.min.js", destination: "public/vendor/live2d/pixi8.min.js" },
  { name: "Pixi Sound 6.0.1", url: "https://cdn.jsdelivr.net/npm/@pixi/sound@6.0.1/dist/pixi-sound.js", destination: "public/vendor/live2d/pixi-sound.js" },
  { name: "Cubism 5 Live2D engine 1.3.5", url: "https://cdn.jsdelivr.net/npm/untitled-pixi-live2d-engine@1.3.5/dist/cubism.min.js", destination: "public/vendor/live2d/cubism5-engine.min.js" },
  { name: "PixiJS 8 license", url: "https://cdn.jsdelivr.net/npm/pixi.js@8.13.1/LICENSE", destination: "public/vendor/live2d/licenses/PIXI8-LICENSE" },
];

const KEI_BASES = [
  "https://raw.githubusercontent.com/zou-hong-run/ai-xiaoyou-web/39fe1a76517416c503a74caf8efb46e477dd95ce/public/model/kei_zh",
  "https://raw.githubusercontent.com/NathanCavallier/alice_ai/628e96197bbcd02273f9af50d749df17c34c6137/web/public/assets/live2d_models/kei_basic_free",
];

const KEI_ASSETS = [
  "kei_basic_free.model3.json",
  "kei_basic_free.moc3",
  "kei_basic_free.2048/texture_00.png",
  "kei_basic_free.physics3.json",
  "kei_basic_free.cdi3.json",
  "kei_basic_free.motionsync3.json",
  "motions/01_kei_en.motion3.json",
  "motions/01_kei_jp.motion3.json",
  "motions/01_kei_ko.motion3.json",
  "motions/01_kei_zh.motion3.json",
  "sounds/01_kei_en.wav",
  "sounds/01_kei_jp.wav",
  "sounds/01_kei_ko.wav",
  "sounds/01_kei_zh.wav",
];

function findEocd(buffer) {
  const signature = 0x06054b50;
  const minimum = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error("ZIP EOCD not found");
}

function extractZipEntry(buffer, wantedName) {
  const eocd = findEocd(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error(`Invalid central directory signature at ${offset}`);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === wantedName) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local header for ${wantedName}`);
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      let output;
      if (method === 0) output = Buffer.from(compressed);
      else if (method === 8) output = inflateRawSync(compressed);
      else throw new Error(`Unsupported ZIP compression method ${method} for ${wantedName}`);
      if (output.length !== uncompressedSize) throw new Error(`ZIP size mismatch for ${wantedName}: ${output.length} != ${uncompressedSize}`);
      return output;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`ZIP entry not found: ${wantedName}`);
}

async function fetchBuffer(url, timeoutMs) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function fetchFirst(urls, timeoutMs) {
  let lastError;
  for (const url of urls) {
    try { return await fetchBuffer(url, timeoutMs); }
    catch (error) { lastError = error; }
  }
  throw lastError ?? new Error("No source available");
}

async function writeOutput(destination, data) {
  const path = resolve(destination);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
  return createHash("sha256").update(data).digest("hex").slice(0, 12);
}

async function prepareCubismCore() {
  console.log(`[live2d] preparing official Cubism SDK ${SDK_VERSION}`);
  const archive = await fetchBuffer(ARCHIVE_URL, 45_000);
  const actualSha256 = createHash("sha256").update(archive).digest("hex");
  if (actualSha256 !== ARCHIVE_SHA256) throw new Error(`Cubism SDK checksum mismatch: ${actualSha256}`);
  for (const [entry, destination] of CUBISM_OUTPUTS) {
    const data = extractZipEntry(archive, entry);
    const digest = await writeOutput(destination, data);
    console.log(`[live2d] prepared ${destination} (${data.length} bytes, sha256:${digest})`);
  }
}

async function prepareCdnRuntime({ name, url, destination }) {
  const data = await fetchBuffer(url, 18_000);
  const digest = await writeOutput(destination, data);
  console.log(`[live2d] prepared ${name} -> ${destination} (sha256:${digest})`);
}

async function prepareKeiModel() {
  console.log("[live2d] caching Kei model locally");
  for (const asset of KEI_ASSETS) {
    const urls = KEI_BASES.map((base) => `${base}/${asset}`);
    const data = await fetchFirst(urls, 25_000);
    const destination = `public/vendor/live2d/kei/${asset}`;
    const digest = await writeOutput(destination, data);
    console.log(`[live2d] prepared Kei ${asset} (${data.length} bytes, sha256:${digest})`);
  }
}

async function main() {
  const tasks = [
    ["Cubism Core", prepareCubismCore],
    ...CDN_OUTPUTS.map((asset) => [asset.name, () => prepareCdnRuntime(asset)]),
    ["Kei model cache", prepareKeiModel],
  ];
  let failed = 0;
  for (const [name, run] of tasks) {
    try { await run(); }
    catch (error) {
      failed += 1;
      console.warn(`[live2d] ${name} local cache unavailable; runtime fallback remains enabled.`);
      console.warn(error instanceof Error ? error.message : error);
    }
  }
  if (failed === 0) console.log("[live2d] local-first Cubism 5 runtime + Kei model cache ready");
  else console.log(`[live2d] completed with ${failed} fallback asset(s); build may continue safely`);
}

main();
