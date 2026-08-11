import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";

/**
 * Developer Console + Structured Logs — the single observability core for the
 * scanner subsystem (and the error paths that feed it).
 *
 * Purpose: replace the ad-hoc `SCANNER_DEBUG` console tracing with a structured
 * logger that records leveled events (`debug|info|warn|error`), attaches an
 * `operationId` (correlation id) via async context, renders a readable
 * developer console, and optionally appends searchable JSONL to a file.
 *
 * Developer-only: the human console output is disabled in production; only
 * WARN/ERROR events may reach stdout there (server logs), never through any
 * admin/UI surface, and never with secrets (no SQL parameters, no tokens).
 *
 * Performance: hot-path DEBUG events are buffered in memory and flushed in a
 * single batch per event-loop tick; file writes go through one buffered
 * `fs.WriteStream` (no fsync per event). The logger self-measures its own
 * overhead (`stats()`).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Numeric ordering used for level filtering. */
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Arbitrary structured fields attached to a log record. Values must be
 * JSON-serializable; objects are stringified for the console renderer.
 */
export interface LogFields {
  [key: string]: unknown;
}

/** One structured log record. */
export interface LogRecord {
  /** ISO-8601 timestamp (UTC). */
  ts: string;
  /** Log level. */
  level: LogLevel;
  /** Dotted event name, e.g. `scanner.started`. */
  event: string;
  /** Logical component that produced the event. */
  component: string;
  /** Current operation id from async context (or `null` outside an op). */
  operationId: string | null;
  /** Optional measured duration. */
  durationMs?: number;
  /** Structured payload. */
  fields: LogFields;
}

const ENV_CONSOLE = "DEV_CONSOLE";
const ENV_LEVEL = "DEV_CONSOLE_LEVEL";
const ENV_LOG_FILE = "DEV_LOG_FILE";

/**
 * Parses a boolean-style environment variable (`1|true|yes|on`, trimmed,
 * case-insensitive) into a boolean.
 *
 * @param name - The environment variable name to read.
 * @returns `true` when the variable holds a truthy value.
 */
function envFlag(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Decides whether the developer console is active. The console is a
 * development-only surface: it is never enabled in production.
 *
 * @returns `true` when outside production and `DEV_CONSOLE=1`.
 */
export function isDevConsoleEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return envFlag(ENV_CONSOLE);
}

/**
 * Resolves the minimum level that passes the filter, from `DEV_CONSOLE_LEVEL`
 * (falls back to `info`).
 *
 * @returns The configured minimum level.
 */
export function configuredLevel(): LogLevel {
  const value = process.env[ENV_LEVEL]?.trim().toLowerCase();
  if (value === "debug" || value === "warn" || value === "error") return value;
  return "info";
}

/**
 * Returns whether a level passes the configured minimum.
 *
 * @param level - The candidate level.
 * @param min - The configured minimum level.
 * @returns `true` when `level` is at least as severe as `min`.
 */
export function passesLevel(level: LogLevel, min: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[min];
}

const operationStore = new AsyncLocalStorage<string | null>();

/**
 * Runs `fn` while `operationId` is the current correlation id. Nested calls
 * inherit the outer id unless a new one is provided.
 *
 * @param operationId - The operation/correlation id to set (or `null` to clear).
 * @param fn - The synchronous or asynchronous work.
 * @returns Whatever `fn` returns.
 */
export function runWithOperationId<T>(operationId: string | null, fn: () => Promise<T>): Promise<T>;
export function runWithOperationId<T>(operationId: string | null, fn: () => T): T;
export function runWithOperationId<T>(
  operationId: string | null,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return operationStore.run(operationId, fn);
}

/**
 * Returns the current operation id from async context.
 *
 * @returns The active operation id, or `null` outside any operation.
 */
export function currentOperationId(): string | null {
  return operationStore.getStore() ?? null;
}

/**
 * Formats a scalar value for the console renderer (objects → JSON).
 *
 * @param value - The value to format.
 * @returns A compact string representation.
 */
function fmtValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Structured logger singleton.
 *
 * Records are kept in memory, rendered as aligned developer-console lines,
 * and (when `DEV_LOG_FILE` is set) appended as JSONL through one buffered
 * stream. All hot-path work happens inside {@link log} with a single buffer
 * push; flushing is coalesced to one operation per event-loop turn.
 */
export class DevLogger {
  private fileStream: fs.WriteStream | null = null;
  private pending: string[] = [];
  private flushScheduled = false;
  private overheadMs = 0;
  private callCount = 0;
  private records: LogRecord[] = [];

  /**
   * Whether this logger will emit anything. The console is dev-only; the JSONL
   * file writer works in any non-secret mode when explicitly configured.
   *
   * @returns `true` when the developer console or the JSONL file is active.
   */
  get enabled(): boolean {
    return isDevConsoleEnabled() || Boolean(process.env[ENV_LOG_FILE]);
  }

  /**
   * Emits one structured record if its level passes the configured minimum.
   *
   * @param level - The severity level.
   * @param event - Dotted event name (e.g. `scanner.phase.started`).
   * @param fields - Structured payload (may include `operationId`/`component`).
   * @param durationMs - Optional measured duration of the described work.
   */
  log(level: LogLevel, event: string, fields: LogFields = {}, durationMs?: number): void {
    if (!this.enabled) return;
    const started = performance.now();
    const min = isDevConsoleEnabled() ? configuredLevel() : "warn";
    if (!passesLevel(level, min)) {
      this.callCount++;
      this.overheadMs += performance.now() - started;
      return;
    }

    const operationId =
      typeof fields["operationId"] === "string"
        ? (fields["operationId"] as string)
        : currentOperationId();
    const component =
      typeof fields["component"] === "string"
        ? (fields["component"] as string)
        : (event.split(".")[0] ?? event);
    const record: LogRecord = {
      ts: new Date().toISOString(),
      level,
      event,
      component,
      operationId,
      durationMs,
      fields,
    };

    this.records.push(record);
    const lines = this.render(record);
    this.pending.push(...lines, "");
    this.scheduleFlush();
    this.appendJsonl(record);

    this.callCount++;
    this.overheadMs += performance.now() - started;
  }

  /** Convenience helper for `debug`-level records. */
  debug(event: string, fields?: LogFields, durationMs?: number): void {
    this.log("debug", event, fields, durationMs);
  }

  /** Convenience helper for `info`-level records. */
  info(event: string, fields?: LogFields, durationMs?: number): void {
    this.log("info", event, fields, durationMs);
  }

  /** Convenience helper for `warn`-level records. */
  warn(event: string, fields?: LogFields, durationMs?: number): void {
    this.log("warn", event, fields, durationMs);
  }

  /** Convenience helper for `error`-level records. */
  error(event: string, fields?: LogFields, durationMs?: number): void {
    this.log("error", event, fields, durationMs);
  }

  /**
   * Renders one record as aligned developer-console lines:
   * `[HH:MM:SS.mmm] LEVEL event` followed by indented `key=value` fields.
   *
   * @param record - The record to render.
   * @returns Ready-to-print lines.
   */
  private render(record: LogRecord): string[] {
    const stamp = record.ts.slice(11, 23);
    const head = `[${stamp}] ${record.level.toUpperCase().padEnd(5)} ${record.event}`;
    const lines: string[] = [head];
    const fieldLines: string[] = [];
    if (record.operationId) fieldLines.push(`operationId=${record.operationId}`);
    if (record.durationMs !== undefined)
      fieldLines.push(`durationMs=${record.durationMs.toFixed(1)}`);
    if (record.component) fieldLines.push(`component=${record.component}`);
    for (const [key, value] of Object.entries(record.fields)) {
      if (key === "operationId" || key === "component") continue;
      fieldLines.push(`${key}=${fmtValue(value)}`);
    }
    const indent = "                 ";
    if (fieldLines.length > 0) lines.push(...fieldLines.map((l) => `${indent}${l}`));
    return lines;
  }

  /**
   * Coalesces buffered console lines into a single stdout write per tick.
   */
  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    setImmediate(() => {
      this.flushScheduled = false;
      if (this.pending.length === 0) return;
      const chunk = this.pending.join("\n");
      this.pending = [];
      if (isDevConsoleEnabled()) process.stdout.write(chunk + "\n");
    });
  }

  /**
   * Appends one JSON line to the configured JSONL file (buffered stream).
   *
   * @param record - The structured record to serialize.
   */
  private appendJsonl(record: LogRecord): void {
    const filePath = process.env[ENV_LOG_FILE];
    if (!filePath) return;
    if (!this.fileStream) {
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      this.fileStream = fs.createWriteStream(filePath, { flags: "a" });
    }
    this.fileStream.write(`${JSON.stringify(record)}\n`);
  }

  /**
   * Returns self-measurement stats for overhead reporting.
   *
   * @returns Number of calls and cumulative time spent inside the logger.
   */
  stats(): { callCount: number; overheadMs: number } {
    return { callCount: this.callCount, overheadMs: this.overheadMs };
  }

  /**
   * Returns every record captured so far (for timeline/filter tooling).
   *
   * @returns A shallow copy of the captured records.
   */
  recordsSnapshot(): LogRecord[] {
    return [...this.records];
  }
}

/** Singleton logger used across the scanner, DB layer and background jobs. */
export const logger = new DevLogger();
