/**
 * Observability layer — Developer Console + Structured Logs.
 *
 * Single entry point for the scanner/DB/background-job logging core. Replace
 * any remaining ad-hoc `console.*`/`scanDebug*` tracing with these APIs:
 *
 * - {@link logger} — leveled structured logger (`debug|info|warn|error`)
 *   with automatic `operationId` correlation via async context.
 * - {@link operations} — operation tree (start/complete, parent links),
 *   parallel-overlap detection and timeline rendering.
 * - {@link trackBackgroundJob} — wraps background jobs so they appear in the
 *   operation tree with `background_job.*` events.
 * - {@link recordDbObservation} / {@link snapshotDbStats} /
 *   {@link diffDbStats} / {@link recordExclusiveWait} — global SQLite
 *   workload counters for bottleneck reports.
 *
 * Developer-only: the console is disabled in production; nothing here touches
 * the event bus, SSE, the database or any admin/UI surface.
 */
export {
  logger,
  isDevConsoleEnabled,
  configuredLevel,
  passesLevel,
  runWithOperationId,
  currentOperationId,
} from "./logger";
export type { LogLevel, LogFields, LogRecord } from "./logger";
export { DevLogger } from "./logger";

export { operations, trackBackgroundJob } from "./operations";
export type {
  OperationInfo,
  OperationStatus,
  StartOperationOptions,
  TypeAggregate,
} from "./operations";

export {
  recordDbObservation,
  recordExec,
  recordExclusiveWait,
  snapshotDbStats,
  diffDbStats,
} from "./db-stats";
export type { DbObservation, DbStatsSnapshot, DbDriverMethod, DbOperationType } from "./db-stats";
