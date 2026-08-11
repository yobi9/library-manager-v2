/**
 * Phase-0 measurement collector for a single scanner run.
 *
 * Purpose: capture a baseline BEFORE any scanner optimization lands. It only
 * counts and times what a scan already does — it never changes what the
 * scanner writes, how it writes, or the order of operations. The orchestrator
 * renders the results as the `scanner.bottlenecks` structured event (via the
 * observability logger) so wall-clock phase timings, per-item sync averages,
 * SAVEPOINT counts and the scanner's SQL statement volume can be compared
 * before/after each optimization phase.
 *
 * Source of truth: this class. It has no dependency on the database or the
 * filesystem, so it is trivially unit-testable in isolation.
 *
 * Scope: one scan run (`ScanOrchestrator.runScanImpl`). A fresh instance is
 * created per scan and never shared between scans; the FTS backfill (which
 * runs fire-and-forget outside the orchestrator) logs its own timing directly
 * via the observability logger in the composition root.
 *
 * Limitations: timings are wall-clock milliseconds inside the Node process
 * and include event-loop wait time while the scan was blocked (e.g. on
 * `SQLITE_BUSY` retries or network I/O). `dbStatements` counts statements
 * issued on the writer connection while a writer context is active — it
 * deliberately excludes reader-connection traffic (regular application reads).
 */

/** One measured phase: an identifier and the elapsed wall-clock time in ms. */
export interface ScanPhaseTiming {
  /** Stable identifier for the phase (e.g. `walk`, `detectDeleted`). */
  phase: string;
  /** Elapsed wall-clock time in milliseconds. */
  ms: number;
}

/**
 * Aggregates measurement counters for one scan execution.
 *
 * @remarks Intentionally mutable and dependency-free: the orchestrator and
 * `MediaSyncService` increment fields directly at their natural observation
 * points. There is no observer/listener plumbing — this keeps the collector
 * a pure accumulator that cannot leak into business logic.
 */
export class ScanMetrics {
  /** Wall-clock timings of the top-level phases, recorded in execution order. */
  readonly phases: ScanPhaseTiming[] = [];

  /** Number of directory syncs performed during the walk. */
  dirSyncs = 0;
  /** Cumulative wall-clock time spent on directory syncs, in ms. */
  dirSyncMs = 0;
  /** Number of directory syncs that failed (thrown or recorded errors). */
  dirSyncErrors = 0;
  /** Number of file syncs performed during the walk. */
  fileSyncs = 0;
  /** Cumulative wall-clock time spent on file syncs, in ms. */
  fileSyncMs = 0;
  /** Number of file syncs that failed (thrown or recorded errors). */
  fileSyncErrors = 0;

  /** Nested per-item SAVEPOINTs opened during the walk (`runNestedSavepoint`). */
  nestedSavepointOpens = 0;
  /** Batch SAVEPOINTs committed during the walk (`closeBatchSavepoint`). */
  batchCommits = 0;
  /** Batch SAVEPOINTs rolled back after a fatal walk failure. */
  batchRollbacks = 0;

  /**
   * SQL statements issued on the writer connection between the walk start and
   * the metrics snapshot (see the module doc: writer-context traffic only).
   */
  dbStatements = 0;

  /** Media items physically deleted by orphan cleanup (including descendants). */
  orphanDeleted = 0;

  /**
   * Times an async phase and records its elapsed wall-clock duration.
   *
   * The error is NOT swallowed: the phase's outcome is identical to calling
   * `fn` directly, and the caller keeps full control of failure handling.
   *
   * @param phase - Identifier for the timed phase.
   * @param fn - The async work to time.
   * @returns The resolved value of `fn`.
   */
  async timePhase<T>(phase: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      return await fn();
    } finally {
      this.phases.push({ phase, ms: Date.now() - startedAt });
    }
  }

  /**
   * Records one directory-sync outcome (elapsed time + success/failure).
   *
   * @param ms - Elapsed wall-clock time for the sync, in milliseconds.
   * @param ok - Whether the item sync completed without an error.
   */
  recordDirSync(ms: number, ok: boolean): void {
    this.dirSyncs++;
    this.dirSyncMs += ms;
    if (!ok) this.dirSyncErrors++;
  }

  /**
   * Records one file-sync outcome (elapsed time + success/failure).
   *
   * @param ms - Elapsed wall-clock time for the sync, in milliseconds.
   * @param ok - Whether the item sync completed without an error.
   */
  recordFileSync(ms: number, ok: boolean): void {
    this.fileSyncs++;
    this.fileSyncMs += ms;
    if (!ok) this.fileSyncErrors++;
  }

  /**
   * Renders a compact multi-line summary of every collected metric.
   *
   * Averages are guarded so an empty run never divides by zero; values are
   * formatted with one decimal place. The string is intended for the
   * observability logger's `scanner.bottlenecks` event (as a human-readable
   * rendering alongside the structured fields).
   *
   * @returns A newline-separated summary string.
   */
  summary(): string {
    const itemTotal = this.dirSyncs + this.fileSyncs;
    const avgDir = this.dirSyncs > 0 ? this.dirSyncMs / this.dirSyncs : 0;
    const avgFile = this.fileSyncs > 0 ? this.fileSyncMs / this.fileSyncs : 0;
    const statementsPerItem = itemTotal > 0 ? this.dbStatements / itemTotal : 0;

    const lines = [
      `dirSyncs=${this.dirSyncs} avgDir=${avgDir.toFixed(1)}ms fileSyncs=${this.fileSyncs} avgFile=${avgFile.toFixed(1)}ms itemTotal=${itemTotal}`,
      `errors dir=${this.dirSyncErrors} file=${this.fileSyncErrors}`,
      `savepoints nested=${this.nestedSavepointOpens} batchCommits=${this.batchCommits} batchRollbacks=${this.batchRollbacks}`,
      `dbStatements=${this.dbStatements} stmtsPerItem=${statementsPerItem.toFixed(2)} orphanDeleted=${this.orphanDeleted}`,
    ];
    if (this.phases.length > 0) {
      lines.push(`phases: ${this.phases.map((p) => `${p.phase}=${p.ms}ms`).join(" ")}`);
    }
    return lines.join("\n");
  }
}
