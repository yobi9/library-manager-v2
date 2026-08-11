import { logger, currentOperationId, runWithOperationId } from "./logger";

/**
 * Operation tree + parallel-operation tracking for the observability layer.
 *
 * Purpose: every meaningful unit of work (a scan, a scan phase, a background
 * job, a long DB operation) is registered as an {@link OperationInfo} with a
 * stable id, an optional parent id and wall-clock timestamps. From that tree
 * we can rebuild the full timeline of a scan, detect which operations ran in
 * parallel, attribute durations to categories (directory scan, file
 * processing, metadata, DB, background jobs) and answer "where did the
 * scanner's time actually go" with real numbers.
 *
 * Developer-only: this is an in-memory structure with no DB writes, no event
 * bus/SSE usage and no business-logic coupling. All methods are no-ops (or
 * near no-ops) when the developer console is disabled.
 */

/** Lifecycle status of a registered operation. */
export type OperationStatus = "running" | "completed" | "failed" | "cancelled";

/** One node in the operation tree. */
export interface OperationInfo {
  /** Stable operation/correlation id. */
  id: string;
  /** Parent operation id, or `null` for a root operation. */
  parentId: string | null;
  /** Category, e.g. `scan`, `phase`, `background_job`, `db`. */
  type: string;
  /** Human-readable label, e.g. `completeScan`. */
  name: string;
  /** Logical component, e.g. `ScanOrchestrator`. */
  component: string;
  /** Wall-clock start in ms since epoch. */
  startedAt: number;
  /** Wall-clock end in ms since epoch, or `null` while running. */
  endedAt: number | null;
  /** Current lifecycle status. */
  status: OperationStatus;
  /** Computed wall-clock duration in ms once completed. */
  durationMs: number | null;
}

/** Options for {@link OperationManager.start}. */
export interface StartOperationOptions {
  /** Explicit id (defaults to an auto-generated `op_...` id). */
  id?: string;
  /** Parent operation id (defaults to the current async operation id). */
  parentId?: string | null;
  /** Logical component label. */
  component?: string;
}

/**
 * Aggregated duration per operation type (used for bottleneck attribution).
 */
export interface TypeAggregate {
  type: string;
  count: number;
  totalMs: number;
}

/**
 * Generates a short unique operation id.
 *
 * @returns An id like `op_m1x2ab9z_3f8kq`.
 */
function nextOperationId(): string {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Operation manager singleton.
 *
 * The tree is keyed by operation id; completion computes `durationMs` from
 * wall-clock timestamps. Parallel overlap is answered by timestamp windows
 * (`overlaps`), which is why every operation stores absolute start/end times.
 */
export class OperationManager {
  private readonly ops = new Map<string, OperationInfo>();

  /**
   * Registers a new operation. The operation id is bound to async context via
   * `runWithOperationId` for the synchronous remainder of the start call, and
   * can be re-bound by the caller around the actual work.
   *
   * @param type - Category (`scan`, `phase`, `background_job`, ...).
   * @param name - Human-readable label.
   * @param options - Id/parent/component overrides.
   * @returns The operation id.
   */
  start(type: string, name: string, options: StartOperationOptions = {}): string {
    if (!logger.enabled) return "";
    const id = options.id ?? nextOperationId();
    const parentId = options.parentId !== undefined ? options.parentId : currentOperationId();
    this.ops.set(id, {
      id,
      parentId,
      type,
      name,
      component: options.component ?? name.split(".")[0] ?? "unknown",
      startedAt: Date.now(),
      endedAt: null,
      status: "running",
      durationMs: null,
    });
    return id;
  }

  /**
   * Marks an operation as finished and computes its duration.
   *
   * @param id - The operation id from {@link start}.
   * @param status - Final status (default `completed`).
   */
  complete(id: string, status: OperationStatus = "completed"): void {
    if (!logger.enabled || !id) return;
    const op = this.ops.get(id);
    if (!op || op.endedAt !== null) return;
    op.endedAt = Date.now();
    op.status = status;
    op.durationMs = op.endedAt - op.startedAt;
  }

  /**
   * Marks an operation as failed (alias of {@link complete} with status).
   *
   * @param id - The operation id.
   */
  fail(id: string): void {
    this.complete(id, "failed");
  }

  /**
   * Marks an operation as cancelled.
   *
   * @param id - The operation id.
   */
  cancel(id: string): void {
    this.complete(id, "cancelled");
  }

  /**
   * Returns one operation by id.
   *
   * @param id - The operation id.
   * @returns The operation info, or `undefined`.
   */
  get(id: string): OperationInfo | undefined {
    return this.ops.get(id);
  }

  /**
   * Returns all operations still marked as running.
   *
   * @returns Running operations.
   */
  active(): OperationInfo[] {
    return [...this.ops.values()].filter((op) => op.status === "running");
  }

  /**
   * Returns operations whose lifetime overlaps the given wall-clock window.
   * Used to report what ran in parallel with a scan.
   *
   * @param startTs - Window start in ms since epoch.
   * @param endTs - Window end in ms since epoch.
   * @returns Overlapping operations (including the scan itself, which the
   * caller can exclude by id).
   */
  overlaps(startTs: number, endTs: number): OperationInfo[] {
    if (!logger.enabled) return [];
    const result: OperationInfo[] = [];
    for (const op of this.ops.values()) {
      const ended = op.endedAt ?? endTs;
      if (ended >= startTs && op.startedAt <= endTs) result.push(op);
    }
    return result;
  }

  /**
   * Returns the direct children of an operation.
   *
   * @param parentId - Parent operation id (or `null`/`""` for roots).
   * @returns Child operations.
   */
  childrenOf(parentId: string | null): OperationInfo[] {
    const key = parentId ?? "";
    return [...this.ops.values()].filter((op) => (op.parentId ?? "") === key);
  }

  /**
   * Aggregates completed durations by operation type, optionally restricted to
   * one subtree.
   *
   * @param rootId - Optional root id to restrict the aggregate to.
   * @returns Per-type totals.
   */
  aggregateByType(rootId?: string): TypeAggregate[] {
    const totals = new Map<string, TypeAggregate>();
    const visit = (op: OperationInfo): void => {
      if (op.durationMs !== null) {
        const entry = totals.get(op.type) ?? { type: op.type, count: 0, totalMs: 0 };
        entry.count += 1;
        entry.totalMs += op.durationMs;
        totals.set(op.type, entry);
      }
      for (const child of this.childrenOf(op.id)) visit(child);
    };
    if (rootId) {
      const root = this.ops.get(rootId);
      if (root) visit(root);
    } else {
      for (const root of this.childrenOf(null)) visit(root);
    }
    return [...totals.values()].sort((a, b) => b.totalMs - a.totalMs);
  }

  /**
   * Renders the operation tree as indented timeline lines (root-first) with
   * wall-clock stamps and durations.
   *
   * @param rootId - Root operation id; defaults to all roots.
   * @returns Ready-to-print lines.
   */
  timelineLines(rootId?: string): string[] {
    const lines: string[] = [];
    const stamp = (ts: number): string => new Date(ts).toISOString().slice(11, 23);
    const walk = (op: OperationInfo, depth: number): void => {
      const pad = "  ".repeat(depth);
      const dur = op.durationMs !== null ? ` (${op.durationMs.toFixed(1)}ms)` : "";
      lines.push(
        `${pad}${stamp(op.startedAt)} ${op.type}:${op.name} [${op.id}] ${op.status}${dur}`,
      );
      for (const child of this.childrenOf(op.id)) walk(child, depth + 1);
    };
    if (!logger.enabled) return lines;
    if (rootId) {
      const root = this.ops.get(rootId);
      if (root) walk(root, 0);
    } else {
      for (const root of this.childrenOf(null)) walk(root, 0);
    }
    return lines;
  }

  /**
   * Clears the whole tree. Called before a scan so successive scans do not
   * share state.
   */
  reset(): void {
    this.ops.clear();
  }
}

/** Singleton operation manager. */
export const operations = new OperationManager();

/**
 * Wraps a background job body so it is registered as an operation, logged with
 * start/complete/fail events and correlated to any concurrent scan through the
 * shared operation id context. Business logic passes through untouched.
 *
 * @param type - Operation type (use `background_job`).
 * @param name - Human-readable job label.
 * @param fn - The job's body.
 * @param options - Id/component overrides (jobId goes in `options.id`).
 * @returns The resolved value of `fn`.
 */
export async function trackBackgroundJob<T>(
  type: string,
  name: string,
  fn: () => Promise<T>,
  options: StartOperationOptions = {},
): Promise<T> {
  if (!logger.enabled) return fn();
  const id = options.id ?? nextOperationId();
  const parentId = options.parentId !== undefined ? options.parentId : currentOperationId();
  operations.start(type, name, { id, parentId, component: options.component });
  logger.info("background_job.started", { jobId: id, jobType: type, jobName: name });
  const started = performance.now();
  try {
    const result = await runWithOperationId(id, fn);
    const durationMs = performance.now() - started;
    operations.complete(id, "completed");
    logger.info(
      "background_job.completed",
      { jobId: id, jobType: type, jobName: name },
      durationMs,
    );
    return result;
  } catch (err) {
    const durationMs = performance.now() - started;
    operations.complete(id, "failed");
    const error = err as Error;
    logger.error(
      "background_job.failed",
      {
        jobId: id,
        jobType: type,
        jobName: name,
        errorName: error?.name ?? "Error",
        errorCode: (error as { code?: string })?.code ?? "",
        message: error?.message ?? String(error),
      },
      durationMs,
    );
    throw err;
  }
}
