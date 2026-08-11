#!/usr/bin/env node
/**
 * LAN launcher for the Library Manager Next.js server.
 *
 * Reads `HOST` and `PORT` from the environment (configurable per deployment —
 * no hard-coded IP inside application code) and starts the Next.js server
 * bound to that interface. This makes the app reachable from any device on
 * the same internal network without Nginx/Apache/containers.
 *
 * Because this launcher runs under plain `node` (not Next.js), it loads
 * `HOST`/`PORT` from `.env` / `.env.local` itself so a restart needs no
 * manual terminal flags. Precedence: process env > `.env.local` > `.env` >
 * built-in defaults.
 *
 * Usage:
 *   node scripts/start-lan.mjs        # next start (production build)
 *   node scripts/start-lan.mjs dev    # next dev (development server)
 *
 * Environment:
 *   HOST  - interface to bind (default "0.0.0.0" = all interfaces)
 *   PORT  - port to listen on      (default "3000")
 *
 * @returns Process exits with the child server's exit code.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const nextBin = path.resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");

/**
 * Parses a simple `KEY=VALUE` dot-env file (no interpolation, no multiline).
 *
 * @param file - Absolute path of the dot-env file to read.
 * @returns Flat map of parsed variables; empty object when the file is
 *          missing or unreadable.
 */
function loadDotEnv(file) {
  const result = {};
  try {
    const content = readFileSync(file, "utf8");
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key) result[key] = value;
    }
  } catch {
    // missing .env / .env.local is fine — defaults apply
  }
  return result;
}

const mode = process.argv[2] === "dev" ? "dev" : "start";

const dotEnv = {
  ...loadDotEnv(path.join(projectRoot, ".env")),
  ...loadDotEnv(path.join(projectRoot, ".env.local")),
};
const host = process.env.HOST || dotEnv.HOST || "0.0.0.0";
const port = process.env.PORT || dotEnv.PORT || "4000";

console.log(`[LAN] starting \`next ${mode}\` on ${host}:${port}`);

const child = spawn(process.execPath, [nextBin, mode, "-H", host, "-p", port], {
  // Pin the working directory to the project root so `process.cwd()`-based
  // paths (database at ./data, public assets, backups, licenses, migrations)
  // resolve correctly no matter where this launcher is invoked from.
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  console.error("[LAN] failed to start Next.js:", err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
