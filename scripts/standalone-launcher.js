#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports --
 * CommonJS Node launcher: this file is intentionally plain CommonJS
 * (package.json has no "type":"module") and boots the generated CJS
 * `server.js`, so `require()` is the correct loading mechanism here. */
/**
 * Production launcher for the Next.js standalone build.
 *
 * The generated `server.js` reads `process.env.PORT` / `process.env.HOSTNAME`
 * directly and does NOT load `.env.*` files by itself, so this wrapper loads
 * the shipped environment files (`.env.production` plus `.env.local`
 * overrides) into the process environment before booting the server.
 *
 * Real environment variables always win; files are read in increasing
 * precedence (`.env.local` overrides `.env.production`).
 *
 * @module standalone-launcher
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;

/**
 * Parses a `.env` style file into the process environment, without
 * overwriting variables that are already set by the OS/service.
 *
 * @param {string} file - Absolute path of the env file to load.
 * @returns {void}
 */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env.production"));
process.env.NODE_ENV = "production";

require("./server.js");
