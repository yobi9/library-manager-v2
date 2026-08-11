#!/usr/bin/env node
/**
 * Assembles a self-contained production release directory from the Next.js
 * standalone build output, then optionally packages it into a portable ZIP.
 *
 * Layout produced at `release/app/`:
 *
 *   server.js              ← Next.js standalone entry
 *   .next/                  ← compiled server + static assets
 *   node_modules/           ← traced production deps (sqlite3, sharp, etc.)
 *   node.exe                ← bundled Node.js runtime (from tools/)
 *   nssm.exe                ← service runner (from tools/)
 *   public/                 ← static assets (fonts, placeholders, library images)
 *   src/backend/db/migrations/  ← SQL migrations (NOT auto-included by standalone)
 *   data/                   ← DB snapshot + licenses (from existing data/)
 *   .env.production         ← template, overwritten at install time
 *   version.json            ← version metadata for runtime diagnostics
 *
 * Usage:
 *   node scripts/build-release.mjs              # full build (npm build + assemble)
 *   node scripts/build-release.mjs --skip-build # skip npm build (reuse existing .next)
 *   node scripts/build-release.mjs --skip-tools # skip fetching node+nssm
 *
 * @module build-release
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  cpSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const RELEASE_DIR = join(ROOT, "release", "app");
const TOOLS_DIR = join(ROOT, "tools");
const DATA_DIR = join(ROOT, "data");
const PUBLIC_DIR = join(ROOT, "public");
const STANDALONE_DIR = join(ROOT, ".next", "standalone");
const STATIC_DIR = join(ROOT, ".next", "static");
const MIGRATIONS_SRC = join(ROOT, "src", "backend", "db", "migrations");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Runs a shell command and streams output to the console. */
function run(cmd, cwd = ROOT) {
  console.log(`\n▸ ${cmd}\n`);
  execSync(cmd, { cwd, stdio: "inherit", env: process.env });
}

/** Creates the `data/` dir inside the release if it doesn't already exist. */
function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// DB snapshot — copy db + WAL sidecars for a consistent snapshot
// ---------------------------------------------------------------------------

/**
 * Copies the SQLite database and WAL sidecars for a consistent snapshot.
 *
 * Including the WAL files ensures that any uncommitted WAL data is preserved.
 * On next boot, SQLite will automatically replay the WAL and create a clean state.
 *
 * @param {string} srcDir - Absolute path of the source data directory.
 * @param {string} destDir - Absolute path of the destination data directory.
 */
function copyDbSnapshot(srcDir, destDir) {
  const candidates = ["media_library.db", "media_library.db-wal", "media_library.db-shm"];
  for (const file of candidates) {
    const src = join(srcDir, file);
    const dest = join(destDir, file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`  ${file} → ${(statSync(dest).size / 1048576).toFixed(1)} MB`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main assembly pipeline
// ---------------------------------------------------------------------------

async function main() {
  const skipBuild = process.argv.includes("--skip-build");
  const skipTools = process.argv.includes("--skip-tools");

  console.log("\n" + "=".repeat(60));
  console.log("  Library Manager V2 — Release Build");
  console.log("=".repeat(60));

  // ── Step 1: Clean release dir ──────────────────────────────────────────
  if (existsSync(RELEASE_DIR)) {
    rmSync(RELEASE_DIR, { recursive: true, force: true });
  }
  ensureDir(RELEASE_DIR);
  console.log(`\nRelease directory: ${RELEASE_DIR}`);

  // ── Step 2: Next.js build ──────────────────────────────────────────────
  if (!skipBuild) {
    console.log("\n▸ Building Next.js (standalone mode)...");
    run("npm.cmd run build", ROOT);
  } else {
    if (!existsSync(STANDALONE_DIR)) {
      throw new Error("Standalone output not found. Run without --skip-build first.");
    }
    console.log("\n▸ Skipping Next.js build (--skip-build)");
  }

  // ── Step 3: Verify standalone output ───────────────────────────────────
  const serverJs = join(STANDALONE_DIR, "server.js");
  if (!existsSync(serverJs)) {
    throw new Error(
      `server.js not found in ${STANDALONE_DIR}. Check next.config.ts output: "standalone".`,
    );
  }

  // ── Step 4: Copy standalone files ──────────────────────────────────────
  console.log("\n▸ Copying standalone output...");
  cpSync(STANDALONE_DIR, RELEASE_DIR, { recursive: true });

  // Next.js copies the FULL `public/` folder into the standalone output —
  // including the 1.8 GB of runtime-enriched media and the developer's data.
  // The slim release controls these itself, so remove the heavy/stale copies.
  for (const rel of [
    "public\\assets\\images\\enriched",
    "data",
    "docs",
    "src",
    ".env.production",
  ]) {
    const p = join(RELEASE_DIR, rel);
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true });
      console.log(`  cleaned (standalone copy): ${rel}`);
    }
  }

  // `.nft.json` files are build-time output-tracing manifests (used only by
  // the build/deploy pipeline). Dynamic `path.join(process.cwd(), "public", …)`
  // patterns make them balloon to megabytes each, so strip them from the
  // standalone output — the standalone runtime never reads them.
  let nftCount = 0;
  let nftBytes = 0;
  for (const f of readdirSync(join(RELEASE_DIR, ".next"), { recursive: true })) {
    const p = join(RELEASE_DIR, ".next", f);
    if (typeof f === "string" && f.endsWith(".nft.json") && statSync(p).isFile()) {
      nftBytes += statSync(p).size;
      rmSync(p, { force: true });
      nftCount += 1;
    }
  }
  if (nftCount > 0) {
    console.log(
      `  cleaned (standalone copy): ${nftCount} *.nft.json (~${(nftBytes / 1e6).toFixed(0)} MB)`,
    );
  }

  // ── Step 5: Copy .next/static (client bundles) ─────────────────────────
  console.log("▸ Copying .next/static...");
  const releaseStatic = join(RELEASE_DIR, ".next", "static");
  ensureDir(releaseStatic);
  cpSync(STATIC_DIR, releaseStatic, { recursive: true });

  // ── Step 6: Copy public assets (sans enriched) ─────────────────────────
  console.log("▸ Copying public assets (fonts, placeholders, libraries, native-agent)...");
  const releasePublic = join(RELEASE_DIR, "public");
  ensureDir(releasePublic);

  // Fonts (static, always shipped)
  const srcFonts = join(PUBLIC_DIR, "fonts");
  if (existsSync(srcFonts)) {
    cpSync(srcFonts, join(releasePublic, "fonts"), { recursive: true });
  }

  // Static SVGs (placeholders)
  const srcPlaceholders = join(PUBLIC_DIR, "assets", "images", "placeholders");
  if (existsSync(srcPlaceholders)) {
    cpSync(srcPlaceholders, join(releasePublic, "assets", "images", "placeholders"), {
      recursive: true,
    });
  }

  // Library images (user-uploaded, part of slim package)
  const srcLibraries = join(PUBLIC_DIR, "assets", "images", "libraries");
  if (existsSync(srcLibraries)) {
    cpSync(srcLibraries, join(releasePublic, "assets", "images", "libraries"), { recursive: true });
  }

  // Avatars (user-uploaded, shipped with existing install data)
  const srcAvatars = join(PUBLIC_DIR, "assets", "images", "avatars");
  if (existsSync(srcAvatars)) {
    cpSync(srcAvatars, join(releasePublic, "assets", "images", "avatars"), { recursive: true });
  }

  // Native folder-picker agent
  const srcAgent = join(PUBLIC_DIR, "native-agent");
  if (existsSync(srcAgent)) {
    cpSync(srcAgent, join(releasePublic, "native-agent"), { recursive: true });
  }

  // Also copy src/public/library images if they exist (dual-location legacy)
  const srcPublicLibs = join(ROOT, "src", "public", "assets", "images", "libraries");
  if (existsSync(srcPublicLibs)) {
    const destLibs = join(releasePublic, "assets", "images", "libraries");
    ensureDir(destLibs);
    cpSync(srcPublicLibs, destLibs, { recursive: true });
  }

  // ── Step 7: Copy SQL migrations ────────────────────────────────────────
  console.log("▸ Copying SQL migrations...");
  const releaseMigrations = join(RELEASE_DIR, "src", "backend", "db", "migrations");
  ensureDir(releaseMigrations);
  if (existsSync(MIGRATIONS_SRC)) {
    cpSync(MIGRATIONS_SRC, releaseMigrations, { recursive: true });
  } else {
    console.warn(`  ⚠ Migrations source not found: ${MIGRATIONS_SRC}`);
  }

  // ── Step 8: Copy data (DB + licenses) ──────────────────────────────────
  console.log("▸ Copying data (DB + licenses)...");
  const releaseData = join(RELEASE_DIR, "data");
  ensureDir(releaseData);

  if (existsSync(join(DATA_DIR, "media_library.db"))) {
    copyDbSnapshot(DATA_DIR, releaseData);
  } else {
    console.warn("  ⚠ media_library.db not found — first boot will create a fresh DB");
  }

  // Licenses
  const srcLic = join(DATA_DIR, "licenses");
  if (existsSync(srcLic)) {
    cpSync(srcLic, join(releaseData, "licenses"), { recursive: true });
  }

  // ── Step 9: Copy tools (node.exe + nssm.exe) ───────────────────────────
  if (!skipTools) {
    console.log("\n▸ Fetching tools...");
    run("node scripts/fetch-tools.mjs", ROOT);
  } else {
    console.log("\n▸ Skipping tool fetch (--skip-tools)");
  }

  // Copy node.exe
  const srcNode = join(TOOLS_DIR, "node.exe");
  const srcNssm = join(TOOLS_DIR, "nssm.exe");
  if (existsSync(srcNode)) {
    copyFileSync(srcNode, join(RELEASE_DIR, "node.exe"));
    console.log(`  node.exe → release/app/node.exe`);
  } else {
    console.warn("  ⚠ node.exe not found in tools/ — run: node scripts/fetch-tools.mjs node");
  }
  if (existsSync(srcNssm)) {
    copyFileSync(srcNssm, join(RELEASE_DIR, "nssm.exe"));
    console.log(`  nssm.exe → release/app/nssm.exe`);
  } else {
    console.warn("  ⚠ nssm.exe not found in tools/ — run: node scripts/fetch-tools.mjs nssm");
  }

  // ── Step 10: Generate version.json ─────────────────────────────────────
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  writeFileSync(
    join(RELEASE_DIR, "version.json"),
    JSON.stringify(
      {
        version: pkg.version,
        nodeVersion: process.version,
        nextVersion: "16.2.12",
        buildDate: new Date().toISOString(),
        platform: process.platform,
        arch: process.arch,
      },
      null,
      2,
    ),
  );

  // ── Step 11: Generate .env.production template ─────────────────────────
  console.log("▸ Generating .env.production template...");
  copyFileSync(
    join(ROOT, "scripts", "standalone-launcher.js"),
    join(RELEASE_DIR, "start-server.js"),
  );
  const envContent = [
    "# Library Manager V2 — Production Environment",
    "# Generated by build-release.mjs. Overwritten by the installer per machine.",
    "",
    "NODE_ENV=production",
    "",
    "# Server binding",
    "HOSTNAME=0.0.0.0",
    "PORT=4000",
    "",
    "# Auth — MUST be set per machine (JWT secret auto-generated at install)",
    "JWT_SECRET=GENERATE_AT_INSTALL",
    "JWT_EXPIRES_IN=7d",
    "",
    "# Database (relative to process.cwd() — resolves inside the app dir)",
    "DATABASE_URL=./data/media_library.db",
    "",
    "# Public URL (used for Secure cookie decision + CORS). Set to LAN IP + port.",
    "NEXT_PUBLIC_APP_URL=http://127.0.0.1:4000",
    "",
    "# CORS — comma-separated origins matching NEXT_PUBLIC_APP_URL",
    "CORS_ORIGINS=http://127.0.0.1:4000",
    "",
    "# External services (adjust if needed)",
    "LIVE_STREAM_BASE_URL=http://localhost:3333",
    "NEXT_PUBLIC_FOLDER_PICKER_URL=http://localhost:5199",
    "",
  ].join("\n");
  writeFileSync(join(RELEASE_DIR, ".env.production"), envContent);

  // ── Step 12: Summary ───────────────────────────────────────────────────
  const countFiles = (dir) => {
    let count = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        count += countFiles(join(dir, entry.name));
      } else {
        count++;
      }
    }
    return count;
  };
  const dirSize = (dir) => {
    let total = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        total += dirSize(p);
      } else {
        total += statSync(p).size;
      }
    }
    return total;
  };

  const files = countFiles(RELEASE_DIR);
  const sizeMB = (dirSize(RELEASE_DIR) / 1048576).toFixed(1);

  console.log("\n" + "=".repeat(60));
  console.log("  Release assembled successfully!");
  console.log(`  Directory : ${RELEASE_DIR}`);
  console.log(`  Files     : ${files.toLocaleString()}`);
  console.log(`  Size      : ${sizeMB} MB`);
  console.log(`  Version   : ${pkg.version}`);
  console.log("=".repeat(60));

  // ── Step 13: Compile the Inno Setup installer (optional) ───────────────
  const iscc = findIscc();
  if (iscc) {
    console.log("\n▸ Compiling installer with Inno Setup...");
    run(`"${iscc}" /DMyAppVersion=${pkg.version} installer\\library-manager.iss`, ROOT);
    console.log(`  Installer written to release\\LibraryManager-Setup-${pkg.version}.exe`);
  } else {
    console.log(
      "\n  ⚠ Inno Setup not found — installer NOT compiled.\n" +
        "    Install Inno Setup 6 (https://jrsoftware.org/isinfo.php) or set INNO_ISCC,\n" +
        "    then run:  ISCC.exe installer\\library-manager.iss",
    );
  }

  console.log(
    "\n  To test the app locally before installing:\n" +
      `    node "${join(RELEASE_DIR, "start-server.js")}"\n` +
      "  The installer will overwrite .env.production with machine-specific values.\n",
  );
}

/**
 * Locates ISCC.exe (Inno Setup compiler) on this machine.
 *
 * @returns {string | null} Absolute path of ISCC.exe, or null when not found.
 */
function findIscc() {
  const candidates = [
    process.env["INNO_ISCC"],
    "C:\\Program Files (x86)\\Inno Setup 7\\ISCC.exe",
    "C:\\Program Files\\Inno Setup 7\\ISCC.exe",
    "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
    "C:\\Program Files\\Inno Setup 6\\ISCC.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

main().catch((err) => {
  console.error("\nBuild failed:", err.message);
  process.exit(1);
});
