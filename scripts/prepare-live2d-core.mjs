import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

const SDK_VERSION = "5-r.5";
const ARCHIVE_URL = `https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-${SDK_VERSION}.zip`;
const ARCHIVE_SHA256 = "67064a7fb1812cf502f5c4a03bfe12cc638c75a621bb4acf06bb28763df06ba0";
const ROOT = `CubismSdkForWeb-${SDK_VERSION}`;

const OUTPUTS = [
  [`${ROOT}/Core/live2dcubismcore.js`, "public/vendor/live2d/live2dcubismcore.js"],
  [`${ROOT}/Core/LICENSE.md`, "public/vendor/live2d/LICENSE.md"],
  [`${ROOT}/Core/RedistributableFiles.txt`, "public/vendor/live2d/RedistributableFiles.txt"],
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
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid central directory signature at ${offset}`);
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    if (name === wantedName) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error(`Invalid local header for ${wantedName}`);
      }

      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

      let output;
      if (method === 0) output = Buffer.from(compressed);
      else if (method === 8) output = inflateRawSync(compressed);
      else throw new Error(`Unsupported ZIP compression method ${method} for ${wantedName}`);

      if (output.length !== uncompressedSize) {
        throw new Error(`ZIP size mismatch for ${wantedName}: ${output.length} != ${uncompressedSize}`);
      }
      return output;
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`ZIP entry not found: ${wantedName}`);
}

async function main() {
  console.log(`[live2d] downloading official Cubism SDK ${SDK_VERSION}`);
  const response = await fetch(ARCHIVE_URL, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`[live2d] Cubism SDK download failed: HTTP ${response.status}`);
  }

  const archive = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash("sha256").update(archive).digest("hex");
  if (actualSha256 !== ARCHIVE_SHA256) {
    throw new Error(`[live2d] Cubism SDK checksum mismatch: ${actualSha256}`);
  }

  for (const [entry, destination] of OUTPUTS) {
    const data = extractZipEntry(archive, entry);
    const path = resolve(destination);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    console.log(`[live2d] prepared ${destination} (${data.length} bytes)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
