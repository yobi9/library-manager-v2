#!/usr/bin/env node
/**
 * Downloads pinned build-time dependencies (Node.js runtime + nssm service runner)
 * into the project-local `tools/` cache directory.
 *
 * Usage:
 *   node scripts/fetch-tools.mjs            # download both tools
 *   node scripts/fetch-tools.mjs node       # download only node.exe
 *   node scripts/fetch-tools.mjs nssm       # download only nssm.exe
 *
 * The cache directory (`tools/`) is not committed. Subsequent runs are no-ops
 * unless the expected files are missing.
 *
 * @module fetch-tools
 */
import { existsSync, mkdirSync, createWriteStream, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import https from "node:https";
import http from "node:http";

const TOOLS_DIR = join(import.meta.dirname, "..", "tools");

// ---------------------------------------------------------------------------
// Pinned versions — update these before each release cycle
// ---------------------------------------------------------------------------
const NODE_VERSION = "22.18.0";
const NODE_ZIP_NAME = `node-v${NODE_VERSION}-win-x64.zip`;
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIP_NAME}`;
const NODE_EXE_PATH_INSIDE_ZIP = `node-v${NODE_VERSION}-win-x64/node.exe`;
const NODE_EXE_SIZE_MIN = 30_000_000; // ~36 MB

const NSSM_VERSION = "2.24";
const NSSM_ZIP_NAME = `nssm-${NSSM_VERSION}.zip`;
const NSSM_URL = `https://nssm.cc/release/${NSSM_ZIP_NAME}`;
const NSSM_EXE_PATH_INSIDE_ZIP = `nssm-${NSSM_VERSION}/win64/nssm.exe`;
const NSSM_EXE_SIZE_MIN = 300_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Downloads a URL to a file with progress logging.
 *
 * @param {string} url - HTTPS URL to fetch.
 * @param {string} dest - Absolute path of the output file.
 * @returns {Promise<void>}
 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    console.log(`  downloading ${url}`);
    client
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const total = Number(res.headers["content-length"] || 0);
        let downloaded = 0;
        const file = createWriteStream(dest);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\r  ${pct}% (${(downloaded / 1048576).toFixed(1)} MB)`);
          }
        });
        pipeline(res, file)
          .then(() => {
            process.stdout.write("\n");
            resolve();
          })
          .catch(reject);
      })
      .on("error", reject);
  });
}

/**
 * Extracts a single file from a ZIP archive using adm-zip.
 *
 * Node v22+ has no built-in ZIP extraction, so we use the project's own
 * `adm-zip` dependency. This avoids adding new deps to the project.
 *
 * @param {string} zipPath - Absolute path of the .zip file.
 * @param {string} entryPath - Path of the entry inside the archive.
 * @param {string} outPath - Destination file path.
 * @returns {Promise<void>}
 */
async function extractFile(zipPath, entryPath, outPath) {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry(entryPath);
  if (!entry) {
    throw new Error(`Entry '${entryPath}' not found in ${zipPath}`);
  }
  const data = entry.getData();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outPath, data);
  console.log(`  extracted ${entryPath} → ${outPath} (${(data.length / 1024).toFixed(0)} KB)`);
}

// ---------------------------------------------------------------------------
// Tool fetchers
// ---------------------------------------------------------------------------

/**
 * Downloads and extracts the Node.js runtime for Windows x64.
 * Only the standalone `node.exe` binary is extracted.
 *
 * @param {string} toolsDir - Absolute path of the tools cache directory.
 * @returns {Promise<void>}
 */
async function fetchNode(toolsDir) {
  const dest = join(toolsDir, "node.exe");
  if (existsSync(dest)) {
    console.log(`node.exe already present (${join(toolsDir, "node.exe")})`);
    return;
  }

  const zipPath = join(toolsDir, NODE_ZIP_NAME);
  await download(NODE_URL, zipPath);
  await extractFile(zipPath, NODE_EXE_PATH_INSIDE_ZIP, dest);

  // Verify minimum size (sanity check — not a cryptographic verification)
  const { statSync } = await import("node:fs");
  const { size } = statSync(dest);
  if (size < NODE_EXE_SIZE_MIN) {
    unlinkSync(dest);
    throw new Error(`Extracted node.exe is too small (${size} bytes), download may be corrupt.`);
  }

  // Clean up the zip after successful extraction
  unlinkSync(zipPath);
  console.log(`  node.exe ready (${(size / 1048576).toFixed(1)} MB)`);
}

/**
 * Downloads and extracts the NSSM service runner for Windows x64.
 *
 * @param {string} toolsDir - Absolute path of the tools cache directory.
 * @returns {Promise<void>}
 */
async function fetchNssm(toolsDir) {
  const dest = join(toolsDir, "nssm.exe");
  if (existsSync(dest)) {
    console.log(`nssm.exe already present (${join(toolsDir, "nssm.exe")})`);
    return;
  }

  const zipPath = join(toolsDir, NSSM_ZIP_NAME);
  await download(NSSM_URL, zipPath);
  await extractFile(zipPath, NSSM_EXE_PATH_INSIDE_ZIP, dest);

  const { statSync } = await import("node:fs");
  const { size } = statSync(dest);
  if (size < NSSM_EXE_SIZE_MIN) {
    unlinkSync(dest);
    throw new Error(`Extracted nssm.exe is too small (${size} bytes), download may be corrupt.`);
  }

  unlinkSync(zipPath);
  console.log(`  nssm.exe ready (${(size / 1024).toFixed(0)} KB)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const target = process.argv[2]; // undefined | "node" | "nssm"
  mkdirSync(TOOLS_DIR, { recursive: true });

  console.log(`\nFetching tools → ${TOOLS_DIR}\n`);

  if (!target || target === "node") {
    await fetchNode(TOOLS_DIR);
  }
  if (!target || target === "nssm") {
    await fetchNssm(TOOLS_DIR);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nFetch failed:", err.message);
  process.exit(1);
});
