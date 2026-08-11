import { logger } from "./logger";
import type { LogFields } from "./logger";

/**
 * Global SQLite workload counters for the observability layer.
 *
 * Purpose: turn the scanner's raw DB traffic into measurable signal. Every
 * statement issued through the wrapped driver methods (`all|get|run|exec`)
 * is classified (query / write / txn statement), timed, and counted here so
 * a scan's bottleneck report can show real statement volume, retries, busy
 * waits and transaction work instead of a single silent counter.
 *
 * Developer-only: counters are plain in-memory integers (no I/O); the
 * optional event logging (e.g. `db.busy`, `db.query.completed`) is gated on
 * `logger.enabled` and never leaks SQL parameters or values — only the SQL
 * keyword (INSERT/UPDATE/DELETE/SELECT/...) and the elapsed time.
 *
 * Scope: process-wide accumulator. Scans snapshot (`snapshotDbStats`) at the
 * start and diff (`diffDbStats`) at the end so parallel scans never corrupt
 * each other's numbers.
 */

/** SQL statement classification derived from the leading keyword. */
export type DbOperationType = "select" | "insert" | "update" | "delete" | "transaction" | "other";

/** Method on the SQLite driver that issued the statement. */
export type DbDriverMethod = "all" | "get" | "run" | "exec";

/** One observed DB statement, passed to {@link recordDbObservation}. */
export interface DbObservation {
  /** Driver method used (`all|get|run|exec`). */
  method: DbDriverMethod;
  /** The raw SQL string (only the leading keyword is ever logged). */
  sql: string;
  /** Elapsed wall-clock time of the call including retries, in ms. */
  durationMs: number;
  /** Number of attempts (1 = no retry needed). */
  attempts: number;
  /** Rows affected by `run` (via `changes`), when available. */
  rowsAffected?: number;
  /** How many `SQLITE_BUSY` retries occurred during the call. */
  busyOccurrences?: number;
  /** Cumulative delay slept on busy retries during the call, in ms. */
  lockWaitMs?: number;
  /** Attribution label from `withDbOperationContext`, if any. */
  context?: string;
}

/** Immutable snapshot of the workload counters. */
export interface DbStatsSnapshot {
  calls: number;
  reads: number;
  writes: number;
  execs: number;
  totalMs: number;
  retries: number;
  busyErrors: number;
  lockWaitMs: number;
  rowsAffected: number;
  beginCount: number;
  commitCount: number;
  commitMs: number;
  rollbackCount: number;
  savepointOpens: number;
  savepointReleases: number;
  exclusiveWaitMs: number;
}

/** Overwrites >= this many ms are reported as `db.op.slow` (debug). */
const SLOW_DB_OP_MS = 200;

interface DbCounters {
  calls: number;
  reads: number;
  writes: number;
  execs: number;
  totalMs: number;
  retries: number;
  busyErrors: number;
  lockWaitMs: number;
  rowsAffected: number;
  beginCount: number;
  commitCount: number;
  commitMs: number;
  rollbackCount: number;
  savepointOpens: number;
  savepointReleases: number;
  exclusiveWaitMs: number;
}

const counters: DbCounters = {
  calls: 0,
  reads: 0,
  writes: 0,
  execs: 0,
  totalMs: 0,
  retries: 0,
  busyErrors: 0,
  lockWaitMs: 0,
  rowsAffected: 0,
  beginCount: 0,
  commitCount: 0,
  commitMs: 0,
  rollbackCount: 0,
  savepointOpens: 0,
  savepointReleases: 0,
  exclusiveWaitMs: 0,
};

/**
 * Classifies a SQL string by its leading keyword.
 *
 * @param sql - The raw SQL statement.
 * @returns The normalized operation type.
 */
function classifySql(sql: string): DbOperationType {
  const keyword = sql.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? "";
  switch (keyword) {
    case "SELECT":
    case "WITH":
    case "EXPLAIN":
    case "PRAGMA":
      return "select";
    case "INSERT":
    case "REPLACE":
      return "insert";
    case "UPDATE":
    case "DELETE":
      return "update";
    case "BEGIN":
    case "COMMIT":
    case "ROLLBACK":
    case "SAVEPOINT":
    case "RELEASE":
      return "transaction";
    default:
      return "other";
  }
}

/**
 * Extracts the SQL keyword for safe logging (never logs parameters/values).
 *
 * @param sql - The raw SQL statement.
 * @returns The uppercase leading keyword, or `unknown`.
 */
function sqlKeyword(sql: string): string {
  return sql.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? "unknown";
}

/**
 * Updates transaction-lifecycle counters for one transaction keyword.
 *
 * @param keyword - The uppercase SQL keyword (`BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE`).
 * @param durationMs - Elapsed time of the statement, in ms.
 */
function trackTransaction(keyword: string, durationMs: number): void {
  switch (keyword) {
    case "BEGIN":
      counters.beginCount++;
      break;
    case "COMMIT":
      counters.commitCount++;
      counters.commitMs += durationMs;
      break;
    case "ROLLBACK":
      counters.rollbackCount++;
      break;
    case "SAVEPOINT":
      counters.savepointOpens++;
      break;
    case "RELEASE":
      counters.savepointReleases++;
      break;
    default:
      break;
  }
}

/**
 * Records one observed DB statement: updates global counters and, when the
 * logger is enabled, emits the relevant events (`db.busy`, `db.transaction.*`,
 * `db.op.slow`, and — at debug level — `db.query.completed`).
 *
 * @param obs - The observed statement.
 * @param operationId - Current correlation id (from the writer/scan context).
 */
export function recordDbObservation(obs: DbObservation, operationId: string | null): void {
  const enabled = logger.enabled;
  if (enabled) {
    counters.calls++;
    counters.totalMs += obs.durationMs;
    if (obs.rowsAffected !== undefined) counters.rowsAffected += obs.rowsAffected;
    if (obs.attempts > 1) counters.retries += obs.attempts - 1;
    if ((obs.busyOccurrences ?? 0) > 0) counters.busyErrors += obs.busyOccurrences ?? 0;
    if ((obs.lockWaitMs ?? 0) > 0) counters.lockWaitMs += obs.lockWaitMs ?? 0;
  } else {
    return;
  }

  const keyword = sqlKeyword(obs.sql);
  const type = classifySql(obs.sql);
  if (type === "select") counters.reads++;
  else if (type === "insert" || type === "update") counters.writes++;
  else if (type === "transaction") trackTransaction(keyword, obs.durationMs);

  if (obs.method === "exec") counters.execs++;

  const fields: LogFields = {
    operationId,
    context: obs.context ?? "",
    operation: keyword,
    method: obs.method,
  };

  if (obs.busyOccurrences && obs.busyOccurrences > 0) {
    logger.warn(
      "db.busy",
      {
        operationId,
        context: obs.context ?? "",
        operation: keyword,
        attempts: obs.attempts,
        busy: obs.busyOccurrences,
        lockWaitMs: obs.lockWaitMs ?? 0,
      },
      obs.durationMs,
    );
  }

  if (type === "transaction") {
    const state = keyword === "SAVEPOINT" ? "open" : keyword === "RELEASE" ? "release" : keyword;
    logger.debug(`db.transaction.${state.toLowerCase()}`, fields, obs.durationMs);
  }

  if (obs.durationMs >= SLOW_DB_OP_MS) {
    logger.debug("db.op.slow", fields, obs.durationMs);
  }

  logger.debug("db.query.completed", fields, obs.durationMs);
}

/**
 * Tracks the driver-method exec counter. Exported helper kept separate from
 * `recordDbObservation` so `exec` accounting stays explicit.
 */
export function recordExec(): void {
  if (logger.enabled) counters.execs++;
}

/**
 * Records how long a caller waited on `withExclusiveTransaction`'s mutex.
 *
 * @param ms - Queue wait time in milliseconds.
 * @param operationId - Current correlation id.
 */
export function recordExclusiveWait(ms: number, operationId: string | null): void {
  if (!logger.enabled || ms <= 0) return;
  counters.exclusiveWaitMs += ms;
  logger.debug("db.transaction.exclusive_wait", { operationId, waitMs: ms }, ms);
}

/**
 * Captures a copy of the current counters (the diff baseline).
 *
 * @returns A snapshot of all counters.
 */
export function snapshotDbStats(): DbStatsSnapshot {
  return { ...counters };
}

/**
 * Computes the delta between a baseline snapshot and the current counters.
 *
 * @param baseline - The snapshot taken earlier (e.g. scan start).
 * @returns The per-counter deltas.
 */
export function diffDbStats(baseline: DbStatsSnapshot): DbStatsSnapshot {
  return {
    calls: counters.calls - baseline.calls,
    reads: counters.reads - baseline.reads,
    writes: counters.writes - baseline.writes,
    execs: counters.execs - baseline.execs,
    totalMs: Math.max(0, counters.totalMs - baseline.totalMs),
    retries: counters.retries - baseline.retries,
    busyErrors: counters.busyErrors - baseline.busyErrors,
    lockWaitMs: Math.max(0, counters.lockWaitMs - baseline.lockWaitMs),
    rowsAffected: counters.rowsAffected - baseline.rowsAffected,
    beginCount: counters.beginCount - baseline.beginCount,
    commitCount: counters.commitCount - baseline.commitCount,
    commitMs: Math.max(0, counters.commitMs - baseline.commitMs),
    rollbackCount: counters.rollbackCount - baseline.rollbackCount,
    savepointOpens: counters.savepointOpens - baseline.savepointOpens,
    savepointReleases: counters.savepointReleases - baseline.savepointReleases,
    exclusiveWaitMs: Math.max(0, counters.exclusiveWaitMs - baseline.exclusiveWaitMs),
  };
}
