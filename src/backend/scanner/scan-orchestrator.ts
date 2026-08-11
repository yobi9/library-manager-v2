import fs from "fs/promises";
import { EventEmitter } from "events";
import pLimit from "p-limit";
import {
  getDatabase,
  getScannerDbStatementCount,
  getWalBytes,
  runInWriterContext,
  withExclusiveTransaction,
  withDbOperationContext,
} from "../db/db";
import { ScanMetrics } from "./scan-metrics";
import type { LibraryRecord, ScanOptions, ScannerEventMap, WalkedItem } from "./scanner-events";
import { ScanState } from "./scan-state";
import { DirectoryWalker } from "./directory-walker";
import { MediaSyncService } from "./media-sync.service";
import { DeletionDetector } from "./deletion-detector";
import { PathValidationService } from "./path-validation.service";
import { HierarchyRules } from "./hierarchy-rules";
import { HierarchyValidator } from "./hierarchy-validator";
import { ImageLinkerService } from "./image-linker.service";
import { ScanAlreadyRunningError } from "./scan-errors";
import { logger } from "../observability/logger";
import { operations } from "../observability/operations";
import { snapshotDbStats, diffDbStats } from "../observability/db-stats";
import type { DbStatsSnapshot } from "../observability/db-stats";
import type { LogFields } from "../observability/logger";
import type { MediaRepository } from "../repositories/media-repository";
import type { LibraryRepository } from "../repositories/library-repository";
import type { SnapshotRepository } from "../repositories/snapshot-repository";
import type { RetryManager } from "../services/retry-manager";
import type { ErrorHandler } from "../services/error-handler";
import { getRetryManager } from "../services/retry-manager";
import { getErrorHandler } from "../services/error-handler";
import type { SettingsService } from "../services/settings-service";

interface ScanOrchestratorConfig {
  maxDepth: number;
  batchDelayMs: number;
  enableFileScan: boolean;
  batchSize: number;
  strictHierarchy: boolean;
}

/**
 * Converts a `ScanMetrics` collector into flat, JSON-serializable fields for
 * the `scanner.metrics` / `scanner.bottlenecks` structured events.
 *
 * @param metrics - The scan's metrics collector.
 * @returns A flat field map (averages pre-computed to one decimal place).
 */
function scanMetricsToFields(metrics: ScanMetrics): LogFields {
  const itemTotal = metrics.dirSyncs + metrics.fileSyncs;
  const avgDir = metrics.dirSyncs > 0 ? metrics.dirSyncMs / metrics.dirSyncs : 0;
  const avgFile = metrics.fileSyncs > 0 ? metrics.fileSyncMs / metrics.fileSyncs : 0;
  return {
    dirSyncs: metrics.dirSyncs,
    avgDirMs: Number(avgDir.toFixed(1)),
    fileSyncs: metrics.fileSyncs,
    avgFileMs: Number(avgFile.toFixed(1)),
    itemTotal,
    dirSyncErrors: metrics.dirSyncErrors,
    fileSyncErrors: metrics.fileSyncErrors,
    nestedSavepointOpens: metrics.nestedSavepointOpens,
    batchCommits: metrics.batchCommits,
    batchRollbacks: metrics.batchRollbacks,
    dbStatements: metrics.dbStatements,
    stmtsPerItem: itemTotal > 0 ? Number((metrics.dbStatements / itemTotal).toFixed(2)) : 0,
    orphanDeleted: metrics.orphanDeleted,
    phases: metrics.phases.map((p) => `${p.phase}=${p.ms}ms`).join(" "),
  };
}

/**
 * A prepared, single-library scan session produced by `prepareScan` and
 * consumed by `runScan`. It keeps every per-scan artifact local so that
 * concurrent child scans (container children / scan-all) can never corrupt
 * each other's state through shared fields on the orchestrator.
 */
interface ScanSession {
  state: ScanState;
  library: LibraryRecord;
  accessiblePaths: string[];
  ownsSlot: boolean;
}

/**
 * A prepared container scan session produced by `prepareContainer` and
 * consumed by `runContainer`.
 */
interface ContainerSession {
  children: LibraryRecord[];
  parentState: ScanState;
  ownsSlot: boolean;
}

export class ScanOrchestrator extends EventEmitter {
  private states = new Map<number, ScanState>();
  private sessions = new Map<number, ScanSession>();
  private containerSessions = new Map<number, ContainerSession>();

  /**
   * Identifier of the single active top-level scan operation. Guards against
   * two overlapping scans (TOCTOU-safe: reserved synchronously before any
   * await in the prepare phase). Values: a scanId, `pending:<id>`,
   * `container_pending:<id>`, or `"batch"` for a scan-all run.
   */
  private _activeScanId: string | null = null;
  private _paused = false;
  private _pausedLibraryId: number | null = null;
  private _pauseWaiters = new Set<() => void>();
  private _aborted = false;

  readonly rules = new HierarchyRules();
  readonly pathValidation = new PathValidationService();
  readonly imageLinkerService: ImageLinkerService;

  directoryWalker: DirectoryWalker;
  deletionDetector: DeletionDetector;
  hierarchyValidator: HierarchyValidator;

  constructor(
    private mediaRepo: MediaRepository,
    private libraryRepo: LibraryRepository,
    private snapshotRepo: SnapshotRepository,
    private config: ScanOrchestratorConfig,
    private retryManager?: RetryManager,
    private errorHandler?: ErrorHandler,
    private settingsService?: SettingsService,
  ) {
    super();
    this.retryManager ??= getRetryManager();
    this.errorHandler ??= getErrorHandler();
    this.imageLinkerService = new ImageLinkerService(this.mediaRepo);
    this.directoryWalker = new DirectoryWalker(this.rules, this.pathValidation, {
      maxDepth: config.maxDepth,
      batchDelayMs: config.batchDelayMs,
      enableFileScan: config.enableFileScan,
    });
    this.deletionDetector = new DeletionDetector();
    this.hierarchyValidator = new HierarchyValidator(this.mediaRepo, this.libraryRepo, this.rules);
  }

  override emit<K extends keyof ScannerEventMap>(event: K, data: ScannerEventMap[K]): boolean {
    return super.emit(event as string, data);
  }

  override on<K extends keyof ScannerEventMap>(
    event: K,
    listener: (data: ScannerEventMap[K]) => void,
  ): this {
    return super.on(event as string, listener as (...args: unknown[]) => void);
  }

  /**
   * Convenience wrapper: prepares (with slot ownership) then runs a scan.
   * Prefer the split `prepareScan` + `runScan` when the caller needs to
   * surface setup errors (e.g. return HTTP 409) before starting the walk.
   */
  async startScan(libraryId: number, options: ScanOptions = {}): Promise<ScanState> {
    await this.prepareScan(libraryId, options);
    return this.runScan(libraryId);
  }

  /**
   * Validates and reserves the single active-scan slot, then performs all
   * pre-walk setup (library load, per-library guard, snapshot start, path
   * accessibility). Throws `ScanAlreadyRunningError` (or a validation
   * error) for any failure so the controller can return a real error
   * instead of a false 202.
   *
   * @param libraryId - The library to scan.
   * @param options - Scan options (`deepScan`, `forceRescan`, `isChildScan`).
   * @param opts.ownsSlot - When true (default for top-level scans) the slot
   *   is reserved and flags reset; child/batch scans pass false.
   * @returns The prepared `ScanState` (also stored in `this.states`).
   */
  async prepareScan(
    libraryId: number,
    options: ScanOptions = {},
    opts: { ownsSlot?: boolean } = {},
  ): Promise<ScanState> {
    return runInWriterContext(() => this.prepareScanImpl(libraryId, options, opts));
  }

  private async prepareScanImpl(
    libraryId: number,
    options: ScanOptions = {},
    opts: { ownsSlot?: boolean } = {},
  ): Promise<ScanState> {
    const ownsSlot = opts.ownsSlot ?? !options.isChildScan;

    if (ownsSlot) {
      if (this._activeScanId !== null) {
        throw new ScanAlreadyRunningError();
      }
      this._activeScanId = `pending:${libraryId}`;
      this._aborted = false;
      this._paused = false;
      this._pausedLibraryId = null;
      this.releasePauseWaiters();
      this.directoryWalker.reset();
    }

    let state: ScanState | undefined;
    let snapshotStarted = false;

    try {
      const existing = this.states.get(libraryId);
      if (existing && existing.status === "scanning") {
        throw new ScanAlreadyRunningError(`Scan already in progress for library ${libraryId}`);
      }

      const library = (await this.retryManager!.executeWithRetry(() =>
        this.libraryRepo.getById(libraryId),
      )) as LibraryRecord | undefined;
      if (!library) throw new Error(`Library ${libraryId} not found`);

      if (library.type === "linked") {
        throw new Error(
          `Library "${library.name}" is a shortcut (linked) and has no paths to scan`,
        );
      }

      const deepScan = options.deepScan ?? (await this.getDeepScanSetting());
      const mode = deepScan ? "deep" : "quick";

      state = new ScanState(libraryId, library.name, library.type, mode);
      this.states.set(libraryId, state);
      if (ownsSlot) this._activeScanId = state.scanId;

      state.setScanning();
      this.emit("scan:started", { libraryId, libraryName: library.name, mode });
      logger.info("scanner.prepared", {
        operationId: state.scanId,
        libraryId,
        libraryName: library.name,
        mode,
        libraryType: library.type,
      });

      this.pathValidation.clearCache();

      const libraryPaths = this.pathValidation.parseLibraryPaths(library);
      if (libraryPaths.length === 0) throw new Error(`No valid paths for library ${libraryId}`);

      await this.snapshotRepo.clearStaleSnapshots();
      await this.snapshotRepo.startScan(libraryId, state.scanId);
      snapshotStarted = true;

      const accessiblePaths: string[] = [];
      for (const p of libraryPaths) {
        const result = await this.pathValidation.checkPathAccessibility(p);
        if (result.accessible) accessiblePaths.push(p);
      }
      if (accessiblePaths.length === 0)
        throw new Error(`No accessible paths for library ${libraryId}`);
      logger.info("scanner.accessible_roots", {
        operationId: state.scanId,
        libraryId,
        accessible: accessiblePaths.length,
        total: libraryPaths.length,
      });

      this.sessions.set(libraryId, { state, library, accessiblePaths, ownsSlot });
      return state;
    } catch (err) {
      if (
        ownsSlot &&
        (this._activeScanId === state?.scanId || this._activeScanId === `pending:${libraryId}`)
      ) {
        this._activeScanId = null;
      }
      if (state) this.states.delete(libraryId);
      if (snapshotStarted && state) {
        await this.snapshotRepo.interruptScan(libraryId, state.scanId).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Executes the walk for a library previously prepared via `prepareScan`.
   * Honors pause/resume/stop through the orchestrator's shared flags; when
   * the scan is stopped it marks the snapshot as interrupted and returns
   * the state without running completion steps.
   *
   * @param libraryId - The library whose prepared session must be executed.
   * @returns The final `ScanState` (completed, stopped or failed).
   */
  async runScan(libraryId: number): Promise<ScanState> {
    return runInWriterContext(() => this.runScanImpl(libraryId));
  }

  private async runScanImpl(libraryId: number): Promise<ScanState> {
    const session = this.sessions.get(libraryId);
    if (!session) throw new Error(`No prepared scan session for library ${libraryId}`);
    const { state, library, accessiblePaths, ownsSlot } = session;

    // قياس المرحلة 0: جامع مقاييس لكل مسح + لقطة أساسية لعدّاد عبارات اتصال
    // الكاتب. يُحسب الفرق في النهاية بدل إعادة التصفير ليتوافق مع المسح
    // المتوازي (حِزَم الحاويات) فلا يتلوث العد بين الأشقاء.
    const metrics = new ScanMetrics();
    const dbStatementsBaseline = getScannerDbStatementCount();
    const dbStatsBaseline = snapshotDbStats();
    const walStartBytes = await getWalBytes();
    const scanOpId = operations.start("scan", `scan:${libraryId}`, {
      id: state.scanId,
      component: "ScanOrchestrator",
    });
    const scanStartedAt = Date.now();

    logger.info("scanner.started", {
      operationId: state.scanId,
      libraryId,
      libraryName: library.name,
      mode: state.mode,
      libraryType: library.type,
      batchSize: this.config.batchSize,
    });

    // مرحلة موقوتة: تُسجَّل في شجرة العمليات (نوع `phase` تحت عملية المسح) وفي
    // `ScanMetrics`، وتُنسب عبارات SQL أثناءها إلى سياق المسح (ربط operationId).
    const timePhase = <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      const opId = operations.start("phase", name, {
        parentId: scanOpId,
        component: "ScanOrchestrator",
      });
      return withDbOperationContext(
        name,
        () =>
          metrics.timePhase(name, async () => {
            try {
              return await fn();
            } finally {
              operations.complete(opId);
            }
          }),
        state.scanId,
      );
    };

    try {
      const deepScan = state.mode === "deep";
      const syncService = new MediaSyncService(
        this.mediaRepo,
        this.snapshotRepo,
        this.rules,
        this.imageLinkerService,
        this.pathValidation,
        state.scanId,
        metrics,
      );
      syncService.resetVisited();

      state.currentActivity = "Scanning filesystem...";
      logger.info("scanner.walk.started", {
        operationId: state.scanId,
        libraryId,
        maxDepth: this.config.maxDepth,
      });

      let processedItems = 0;
      // كل مسيرة المشي تعمل داخل معاملة دفعة واحدة (تحفظة خارجية) بدلاً من
      // معاملة لكل عنصر: كل `batchSize` عنصر يُلتزمون معاً، والعنصر الفاشل
      // يتراجع إلى SAVEPOINT الخاص به فقط — انظر `MediaSyncService.runBatched`.
      const walkResult = await timePhase("walk", () =>
        syncService.runBatched(
          () =>
            this.directoryWalker.walk(
              library,
              async (item: WalkedItem) => {
                if (this._aborted) return null;
                if (this._paused) await this.waitForResume();
                if (this._aborted) return null;

                if (item.isRootFolder) {
                  state.currentRootFolder = item.name;
                  state.currentRootType = item.itemType;
                  state.currentRootPath = item.path;
                  logger.debug("scanner.root", {
                    operationId: state.scanId,
                    libraryId,
                    libraryName: library.name,
                    name: item.name,
                    type: item.itemType,
                  });
                }

                this.emit("scan:item", {
                  libraryId,
                  libraryName: library.name,
                  itemName: item.name,
                  itemType: item.itemType ?? "unknown",
                  itemPath: item.path,
                  isFile: item.isFile,
                  isRootFolder: item.isRootFolder,
                });

                processedItems++;
                if (processedItems % 100 === 0) {
                  logger.debug("scanner.progress", {
                    operationId: state.scanId,
                    libraryId,
                    items: processedItems,
                    added: state.stats.mediaAdded,
                    updated: state.stats.mediaUpdated,
                  });
                }

                if (item.isFile) {
                  const parentId = item.parentMediaId ?? 0;
                  try {
                    const result = await syncService.syncFile(item, library, parentId, deepScan);
                    if (result.isNew) state.stats.mediaAdded++;
                    if (result.isUpdated) state.stats.mediaUpdated++;
                    return result.mediaId;
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    state.addError({ type: "file", item: item.name, error: msg });
                    this.emit("scan:error", { libraryId, error: msg, path: item.path });
                    return null;
                  }
                }

                try {
                  const result = await syncService.syncDirectory(item, library, deepScan);
                  if (result.isNew) state.stats.mediaAdded++;
                  if (result.isUpdated) state.stats.mediaUpdated++;
                  return result.mediaId;
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  state.addError({ type: "directory", item: item.name, error: msg });
                  this.emit("scan:error", { libraryId, error: msg, path: item.path });
                  return null;
                }
              },
              () => this.checkPause(),
            ),
          this.config.batchSize,
        ),
      );

      state.stats.foldersScanned = walkResult.foldersScanned;
      state.stats.filesSkipped = walkResult.filesSkipped;
      state.stats.foldersExcluded = walkResult.foldersExcluded;
      logger.info("scanner.walk.completed", {
        operationId: state.scanId,
        libraryId,
        folders: walkResult.foldersScanned,
        files: walkResult.filesScanned,
        foldersSkipped: walkResult.foldersSkipped,
        filesSkipped: walkResult.filesSkipped,
        excluded: walkResult.foldersExcluded,
      });

      if (this._aborted) {
        state.setStopped();
        await this.snapshotRepo.interruptScan(libraryId, state.scanId);
        metrics.dbStatements = getScannerDbStatementCount() - dbStatementsBaseline;
        const walEndBytes = await getWalBytes();
        this.reportScanBottlenecks({
          operationId: state.scanId,
          scanStartedAt,
          metrics,
          dbStatsBaseline,
          walStartBytes,
          walEndBytes,
        });
        logger.info("scanner.stopped", {
          operationId: state.scanId,
          libraryId,
          mode: state.mode,
          durationMs: Date.now() - scanStartedAt,
        });
        return state;
      }

      await timePhase("flushParentCounts", () => syncService.flushParentCounts());

      state.currentActivity = "Detecting deleted items...";
      const deleted = await timePhase("detectDeleted", () =>
        this.deletionDetector.detectDeleted(libraryId, accessiblePaths, state.scanId),
      );
      state.stats.mediaSkipped += deleted.markedUnavailable;

      state.currentActivity = "Completing scan...";
      await timePhase("completeScan", () => this.completeScan(state, library, syncService));

      // Orphan cleanup runs BEFORE emitting `scan:completed`: the event triggers
      // the fire-and-forget FTS backfill (`services/index.ts`), and both hold
      // SAVEPOINTs on the same connection — running them concurrently corrupted
      // the savepoint stack ("no such savepoint"). The connection lock in
      // `cleanupOrphanedItems` is the second line of defense.
      metrics.orphanDeleted = await timePhase("orphanCleanup", () =>
        this.cleanupOrphanedItems(libraryId),
      );

      // كاتب المسح يعمل بـ `wal_autocheckpoint = 0` فلا يحدث checkpoint تلقائي
      // أثناء المسح (كان يحدث كل ~8MB من الكتابة فيحجب القراءات/الكتابات على
      // الاتصال الرئيسي — سبب ذروات `/api/libraries`). checkpoint واحد سلمي في
      // نهاية المسح قبل إصدار `scan:completed` يضمّ WAL دون حجب أي مورد.
      await this.checkpointWal();

      metrics.dbStatements = getScannerDbStatementCount() - dbStatementsBaseline;
      const walEndBytes = await getWalBytes();
      this.reportScanBottlenecks({
        operationId: state.scanId,
        scanStartedAt,
        metrics,
        dbStatsBaseline,
        walStartBytes,
        walEndBytes,
      });

      state.setCompleted();
      this.emit("scan:completed", {
        libraryId,
        libraryName: library.name,
        stats: { ...state.stats },
        duration: state.duration,
      });
      operations.complete(scanOpId, "completed");
      logger.info("scanner.completed", {
        operationId: state.scanId,
        libraryId,
        libraryName: library.name,
        mode: state.mode,
        added: state.stats.mediaAdded,
        updated: state.stats.mediaUpdated,
        markedUnavailable: state.stats.mediaSkipped,
        durationMs: state.duration,
      });

      return state;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      metrics.dbStatements = getScannerDbStatementCount() - dbStatementsBaseline;
      const walEndBytes = await getWalBytes();
      this.reportScanBottlenecks({
        operationId: state.scanId,
        scanStartedAt,
        metrics,
        dbStatsBaseline,
        walStartBytes,
        walEndBytes,
      });
      await this.snapshotRepo.interruptScan(libraryId, state.scanId).catch(() => {});
      state.setFailed();
      this.emit("scan:failed", { libraryId, libraryName: library.name, error: msg });
      operations.complete(scanOpId, "failed");
      logger.error("scanner.failed", {
        operationId: state.scanId,
        libraryId,
        libraryName: library.name,
        error: msg,
        durationMs: Date.now() - scanStartedAt,
      });
      throw err;
    } finally {
      this.sessions.delete(libraryId);
      if (ownsSlot) {
        if (this._activeScanId === state.scanId) {
          this._activeScanId = null;
        }
        this.terminateChildSessions();
      }
    }
  }

  /**
   * Convenience wrapper around `prepareContainer` + `runContainer`.
   */
  async scanContainer(library: LibraryRecord, options: ScanOptions = {}): Promise<ScanState> {
    await this.prepareContainer(library, options);
    return this.runContainer(library.library_id, options);
  }

  /**
   * Reserves the active-scan slot for a container scan and fetches its child
   * libraries. Throws `ScanAlreadyRunningError` when another scan is active.
   *
   * @param library - The container/main library record.
   * @param options - Scan options forwarded to each child scan.
   * @param opts.ownsSlot - When false the caller already holds the slot
   *   (scan-all batch); used for child scans only.
   */
  async prepareContainer(
    library: LibraryRecord,
    options: ScanOptions = {},
    opts: { ownsSlot?: boolean } = {},
  ): Promise<void> {
    const ownsSlot = opts.ownsSlot ?? true;

    if (ownsSlot) {
      if (this._activeScanId !== null) {
        throw new ScanAlreadyRunningError();
      }
      this._activeScanId = `container_pending:${library.library_id}`;
      this._aborted = false;
      this._paused = false;
      this._pausedLibraryId = null;
      this.releasePauseWaiters();
      this.directoryWalker.reset();
    }

    let parentState: ScanState | undefined;
    try {
      const existing = this.states.get(library.library_id);
      if (existing && existing.status === "scanning") {
        throw new ScanAlreadyRunningError(
          `Scan already in progress for library ${library.library_id}`,
        );
      }

      const children = (await this.libraryRepo.getByParent(
        library.library_id as number,
      )) as LibraryRecord[];

      parentState = new ScanState(library.library_id, library.name, library.type, "quick");
      parentState.setScanning();
      this.states.set(library.library_id, parentState);
      if (ownsSlot) this._activeScanId = parentState.scanId;

      this.containerSessions.set(library.library_id, {
        children,
        parentState,
        ownsSlot,
      });
    } catch (err) {
      if (ownsSlot && this._activeScanId === `container_pending:${library.library_id}`) {
        this._activeScanId = null;
      }
      if (parentState) this.states.delete(library.library_id);
      throw err;
    }
  }

  /**
   * Runs the child scans of a previously prepared container, aggregating
   * their stats into the parent state.
   *
   * @param libraryId - The container library whose prepared session runs.
   * @returns The completed parent `ScanState`.
   */
  async runContainer(libraryId: number, options: ScanOptions = {}): Promise<ScanState> {
    const session = this.containerSessions.get(libraryId);
    if (!session) throw new Error(`No prepared container scan session for library ${libraryId}`);
    const { children, parentState, ownsSlot } = session;

    try {
      const batchSize = 3;
      for (let i = 0; i < children.length; i += batchSize) {
        const batch = children.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (child) => {
            try {
              await this.prepareScan(
                child.library_id,
                { ...options, isChildScan: true },
                { ownsSlot: false },
              );
              const childResult = await this.runScan(child.library_id);
              parentState.stats.foldersScanned += childResult.stats.foldersScanned;
              parentState.stats.mediaAdded += childResult.stats.mediaAdded;
              parentState.stats.mediaUpdated += childResult.stats.mediaUpdated;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              parentState.addError({
                type: "general",
                error: msg,
                item: `child-${child.library_id}`,
              });
              this.emit("scan:error", { libraryId: child.library_id, error: msg });
            }
          }),
        );
      }

      parentState.setCompleted();
      this.emit("scan:completed", {
        libraryId,
        libraryName: parentState.libraryName,
        stats: { ...parentState.stats },
        duration: parentState.duration,
      });
      return parentState;
    } finally {
      this.containerSessions.delete(libraryId);
      if (ownsSlot && this._activeScanId === parentState.scanId) {
        this._activeScanId = null;
      }
    }
  }

  /**
   * Synchronously reserves the active-scan slot for a scan-all batch.
   * Throws `ScanAlreadyRunningError` when any scan is already active.
   */
  prepareScanAll(): void {
    if (this._activeScanId !== null) {
      throw new ScanAlreadyRunningError();
    }
    this._activeScanId = "batch";
    this._aborted = false;
    this._paused = false;
    this._pausedLibraryId = null;
    this.releasePauseWaiters();
    this.directoryWalker.reset();
  }

  /**
   * Runs every active library sequentially under the batch slot reserved by
   * `prepareScanAll`. Containers and main-type libraries are scanned through
   * their container flow; individual libraries through prepare/run. Per-
   * library failures are collected and reported, not thrown.
   *
   * @param libraries - The libraries to scan (from `LibraryService.getAllActive`).
   * @returns Per-library success/failure results.
   */
  async runScanAll(
    libraries: LibraryRecord[],
    options: ScanOptions = {},
  ): Promise<Array<{ libraryId: number; success: boolean; error?: string }>> {
    const results: Array<{ libraryId: number; success: boolean; error?: string }> = [];

    try {
      for (const lib of libraries) {
        const libId = lib.library_id;
        const isContainer = Boolean(lib.is_container);
        const type = lib.type;

        try {
          if (isContainer || type === "main") {
            await this.prepareContainer(lib, options, { ownsSlot: false });
            await this.runContainer(libId, options);
          } else {
            await this.prepareScan(libId, options, { ownsSlot: false });
            await this.runScan(libId);
          }
          results.push({ libraryId: libId, success: true });
        } catch (err) {
          results.push({ libraryId: libId, success: false, error: (err as Error).message });
        }
      }

      return results;
    } finally {
      if (this._activeScanId === "batch") {
        this._activeScanId = null;
      }
    }
  }

  pauseScan(libraryId: number): boolean {
    const state = this.states.get(libraryId);
    if (!state || state.status !== "scanning") return false;
    this._paused = true;
    this._pausedLibraryId = libraryId;
    state.setPaused();
    this.emit("scan:paused", { libraryId: libraryId, libraryName: state.libraryName });
    return true;
  }

  resumeScan(libraryId: number): boolean {
    if (!this._paused || this._pausedLibraryId !== libraryId) return false;
    this._paused = false;
    this._pausedLibraryId = null;
    this.releasePauseWaiters();
    const state = this.states.get(libraryId);
    if (state) state.setResumed();
    this.emit("scan:resumed", { libraryId, libraryName: state?.libraryName ?? "" });
    return true;
  }

  /**
   * Stops the active scan(s). Releases any pause waiters first so a walker
   * blocked in `waitForResume` cannot hang forever, then marks the states
   * as stopped. The owning `runScan` observes `_aborted` after the walk and
   * marks the snapshot as interrupted instead of completing.
   *
   * A paused scan is also stoppable: its state is `paused`, not `scanning`,
   * but its walker is blocked on a pause waiter that must be released here.
   */
  stopScan(libraryId?: number): boolean {
    const isActive = (s: ScanState) => s.status === "scanning" || s.status === "paused";

    const activeStates = libraryId
      ? (() => {
          const s = this.states.get(libraryId);
          return s && isActive(s) ? [s] : [];
        })()
      : Array.from(this.states.values()).filter(isActive);

    if (activeStates.length === 0) return false;

    this.directoryWalker.abort();
    this._aborted = true;
    this._paused = false;
    this._pausedLibraryId = null;
    this.releasePauseWaiters();

    for (const s of activeStates) {
      s.setStopped();
      this.emit("scan:stopped", { libraryId: s.libraryId, libraryName: s.libraryName });
    }

    // Stop cascades to child sessions that never finished: a prepared child
    // scan (ownsSlot=false) left "scanning" would block a later scan of that
    // library via the per-library guard, so terminate and drop it here.
    this.terminateChildSessions();
    return true;
  }

  /**
   * Terminates and removes every prepared child session (`ownsSlot === false`)
   * that is still in a live state. Used when the owning top-level scan stops or
   * finishes, so dangling child sessions cannot poison later scans.
   */
  private terminateChildSessions(): void {
    for (const [libraryId, session] of this.sessions) {
      if (session.ownsSlot) continue;
      const state = session.state;
      if (state.status === "scanning" || state.status === "paused") {
        state.setStopped();
        this.emit("scan:stopped", {
          libraryId: state.libraryId,
          libraryName: state.libraryName,
        });
      }
      this.sessions.delete(libraryId);
    }
  }

  getProgress(libraryId: number) {
    const state = this.states.get(libraryId);
    if (!state) return { libraryId, status: "idle" as const };
    return state.toProgress();
  }

  /**
   * Progress snapshot of the most recently started active scan (scanning or
   * paused), or `null` when no scan is currently active.
   *
   * Used by the SSE endpoint when no specific `libraryId` is given, so a page
   * reload can detect and display a scan that is still running — whether it is
   * a single-library scan, a scan-all batch (run sequentially), or a container
   * child scan (the most recently started child wins).
   *
   * @returns The active `ScanProgress` snapshot, or `null`.
   */
  getActiveProgress() {
    let active: ScanState | null = null;
    for (const state of this.states.values()) {
      if (state.status !== "scanning" && state.status !== "paused") continue;
      // `>=` لا `>`: عند تساوي زمن البدء (نفس المللي ثانية) يفوز الأحدث
      // إدراجاً (الطفل/الأحدث بدءاً) بدل بقاء الأب — كما يعتمد الاختبار.
      if (!active || state.startTime.getTime() >= active.startTime.getTime()) {
        active = state;
      }
    }
    return active ? active.toProgress() : null;
  }

  getState(libraryId: number): ScanState | null {
    return this.states.get(libraryId) ?? null;
  }

  isScanning(libraryId?: number): boolean {
    if (libraryId) {
      const state = this.states.get(libraryId);
      return state?.status === "scanning";
    }
    for (const s of this.states.values()) {
      if (s.status === "scanning") return true;
    }
    return false;
  }

  clearState(libraryId?: number) {
    if (libraryId) {
      this.states.delete(libraryId);
    } else {
      this.states.clear();
    }
  }

  private async completeScan(
    state: ScanState,
    library: LibraryRecord,
    syncService: MediaSyncService,
  ) {
    const db = await getDatabase();

    // Stamp `last_scan_id` and re-activate only rows that actually changed during
    // this walk. `getWrittenIds()` tracks created/updated/reactivated items (and
    // the owners of any created/changed file), so untouched items — the common
    // quick-scan fast path — are never rewritten. The WHERE guard is the second
    // line of defense: it skips rows already stamped with this scan id and still
    // re-activates any `is_available = 0` row that reaches this point.
    const ids = Array.from(syncService.getWrittenIds() ?? []);
    if (ids.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const ph = batch.map(() => "?").join(",");
        await db.run(
          `
          UPDATE media_items
          SET is_available = 1,
              unavailable_since = NULL,
              unavailable_reason = NULL,
              last_scan_id = ?
          WHERE media_id IN (${ph})
            AND library_id = ?
            AND (is_available = 0 OR last_scan_id IS NULL OR last_scan_id != ?)
          `,
          [state.scanId, ...batch, library.library_id, state.scanId],
        );
        await new Promise((r) => setImmediate(r));
      }
    }
    await this.updateLibraryStats(library.library_id);
    const snapshotChanges = await this.snapshotRepo.completeScan(library.library_id, state.scanId, {
      media_count: state.stats.mediaAdded,
      folder_count: state.stats.foldersScanned,
      file_count: state.stats.mediaUpdated,
      error_count: state.stats.errors.length,
      duration_ms: state.duration,
    });
    if (snapshotChanges === 0) {
      logger.warn("scanner.snapshot_no_start", {
        operationId: state.scanId,
        scanId: state.scanId,
      });
    }
  }

  private async updateLibraryStats(libraryId: number) {
    await this.retryManager!.executeWithRetry(async () => {
      const db = await getDatabase();
      await db.run(
        `
        UPDATE libraries
        SET media_count = (
          SELECT COUNT(*) FROM media_items
          WHERE library_id = ? AND parent_media_id IS NULL AND is_available = 1
        ),
        last_scanned = CURRENT_TIMESTAMP
        WHERE library_id = ?
      `,
        [libraryId, libraryId],
      );
    });
  }

  /**
   * Deletes media items whose files no longer exist on disk, within a single
   * SAVEPOINT so a failure rolls back cleanly without corrupting the scan.
   *
   * Performance notes (scanner-only scope):
   * - Keyset pagination on `media_id` replaces `OFFSET` so the query stays
   *   index-friendly on large libraries.
   * - `fs.access` runs once per unique `directory_path` (parent folder) instead
   *   of once per item, cutting filesystem round-trips on slow network shares
   *   where many items share a folder.
   *
   * @param libraryId - Target library whose available items are verified.
   * @returns Total number of deleted media items (including descendants).
   */
  private async cleanupOrphanedItems(libraryId: number): Promise<number> {
    const errorHandler = this.errorHandler!;
    try {
      // Whole-function lock: this SAVEPOINT stays open across the keyset loop,
      // so it must never interleave with another savepoint transaction (FTS
      // backfill, scan walk) on the shared connection.
      return await withExclusiveTransaction(async () => {
        const db = await getDatabase();
        const savepoint = `sp_cleanup_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        try {
          await db.run(`SAVEPOINT ${savepoint}`);
          const batchSize = 1000;
          let lastMediaId = 0;
          let totalDeleted = 0;

          const limit = pLimit(50);
          while (true) {
            const candidates = (await db.all(
              `
              SELECT media_id, directory_path FROM media_items
              WHERE library_id = ? AND is_available = 1 AND media_id > ?
              ORDER BY media_id
              LIMIT ?
            `,
              [libraryId, lastMediaId, batchSize],
            )) as Array<{ media_id: number; directory_path: string }>;
            if (candidates.length === 0) break;
            lastMediaId = candidates[candidates.length - 1]!.media_id;

            const uniquePaths = Array.from(new Set(candidates.map((c) => c.directory_path)));
            const existsByPath = await Promise.all(
              uniquePaths.map((dirPath) =>
                limit(async () => {
                  try {
                    await fs.access(dirPath);
                    return true;
                  } catch (err) {
                    const e = err as NodeJS.ErrnoException;
                    return e.code !== "ENOENT";
                  }
                }),
              ),
            );
            const missingPaths = new Set(uniquePaths.filter((_, index) => !existsByPath[index]));

            const toDelete = candidates
              .filter((c) => missingPaths.has(c.directory_path))
              .map((c) => c.media_id);
            if (toDelete.length > 0) {
              const ph = toDelete.map(() => "?").join(",");
              const descendants = (await db.all(
                `
                WITH RECURSIVE descendants AS (
                  SELECT media_id FROM media_items WHERE media_id IN (${ph})
                  UNION ALL
                  SELECT m.media_id FROM media_items m
                  INNER JOIN descendants d ON m.parent_media_id = d.media_id
                )
                SELECT media_id FROM descendants
              `,
                toDelete,
              )) as Array<{ media_id: number }>;
              const ids = descendants.map((d) => d.media_id);
              if (ids.length > 0) {
                const dph = ids.map(() => "?").join(",");
                await db.run(`DELETE FROM media_files WHERE media_id IN (${dph})`, ids);
                await db.run(`DELETE FROM media_items WHERE media_id IN (${dph})`, ids);
              }
              totalDeleted += ids.length;
            }
            await new Promise((r) => setImmediate(r));
          }

          await db.run(`RELEASE SAVEPOINT ${savepoint}`);
          return totalDeleted;
        } catch (err) {
          try {
            await db.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          } catch {
            /* ignore */
          }
          throw err;
        }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await errorHandler.logError(error, { context: "cleanupOrphanedItems", libraryId });
      return 0;
    }
  }

  /**
   * ينفّذ `PRAGMA wal_checkpoint(PASSIVE)` على اتصال الكاتب لضمّ محتوى WAL إلى
   * ملف القاعدة.
   *
   * يُستدعى في نهاية المسح الناجح (بعد تنظيف الأيتام وقبل إصدار
   * `scan:completed`). كاتب المسح يعمل بـ `wal_autocheckpoint = 0` فلا يحدث
   * checkpoint تلقائي أثناء المسح — كان يحدث كل ~8MB من الكتابة فيحجب القراءات
   * على الاتصال الرئيسي (سبب ذروات `/api/libraries`). checkpoint واحد سلمي بعد
   * انتهاء الكتابة يحدّ نمو WAL دون حجب أي مورد (PASSIVE لا يفشل إن كان هناك
   * قارئ نشط).
   *
   * @throws لا يُرمى — أي فشل يُسجَّل كتحذير فقط حتى لا يقطع المسح.
   */
  private async checkpointWal(): Promise<void> {
    try {
      const db = await getDatabase();
      await db.run("PRAGMA wal_checkpoint(PASSIVE);");
    } catch (err) {
      logger.warn("scanner.checkpoint_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Emits the `scanner.bottlenecks` structured event: per-phase timings, DB
   * workload diff, parallel background jobs, per-type duration aggregates, WAL
   * growth around the scan and the operation timeline — everything needed to
   * answer "where did the scan's time go" for the developer console.
   *
   * @param opts.operationId - The scan operation/correlation id.
   * @param opts.scanStartedAt - Wall-clock scan start (ms since epoch).
   * @param opts.metrics - The scan's `ScanMetrics` collector.
   * @param opts.dbStatsBaseline - The `snapshotDbStats` baseline taken at scan
   *   start; the diff is computed at report time.
   * @param opts.walStartBytes - WAL size at scan start (before any writes).
   * @param opts.walEndBytes - WAL size measured right before this report; the
   *   difference (`walGrowthBytes`) quantifies how much the scan wrote to WAL
   *   and how big a checkpoint it forces.
   */
  private reportScanBottlenecks(opts: {
    operationId: string;
    scanStartedAt: number;
    metrics: ScanMetrics;
    dbStatsBaseline: DbStatsSnapshot;
    walStartBytes: number;
    walEndBytes: number;
  }): void {
    const { operationId, scanStartedAt, metrics, dbStatsBaseline, walStartBytes, walEndBytes } =
      opts;
    const diff = diffDbStats(dbStatsBaseline);
    const now = Date.now();
    const parallelJobs = operations
      .overlaps(scanStartedAt, now)
      .filter((op) => op.type === "background_job");
    const byType = operations.aggregateByType(operationId);
    const loggerStats = logger.stats();
    logger.info("scanner.bottlenecks", {
      operationId,
      wallMs: now - scanStartedAt,
      ...scanMetricsToFields(metrics),
      dbCalls: diff.calls,
      dbReads: diff.reads,
      dbWrites: diff.writes,
      dbTotalMs: Math.round(diff.totalMs),
      dbBusyRetries: diff.busyErrors,
      dbLockWaitMs: Math.round(diff.lockWaitMs),
      dbRetries: diff.retries,
      dbTxnBegins: diff.beginCount,
      dbSavepoints: diff.savepointOpens,
      walStartBytes,
      walEndBytes,
      walGrowthBytes: Math.max(0, walEndBytes - walStartBytes),
      parallelJobs:
        parallelJobs.length > 0 ? parallelJobs.map((j) => `${j.name}[${j.id}]`).join(", ") : "none",
      byType: byType.map((a) => `${a.type}(${a.count})=${Math.round(a.totalMs)}ms`).join(" "),
      loggerOverheadMs: Number(loggerStats.overheadMs.toFixed(1)),
      loggerCalls: loggerStats.callCount,
    });
    logger.debug("scanner.timeline", {
      operationId,
      timeline: operations.timelineLines(operationId).join("\n"),
    });
  }

  private async getDeepScanSetting(): Promise<boolean> {
    if (!this.settingsService) return false;
    try {
      const val = await this.settingsService.getSetting("deep_scan_enabled");
      return val === true;
    } catch {
      return false;
    }
  }

  private checkPause() {
    return this._paused ? this.waitForResume() : Promise.resolve();
  }

  private waitForResume(): Promise<void> {
    return new Promise((resolve) => {
      this._pauseWaiters.add(resolve);
    });
  }

  private releasePauseWaiters() {
    for (const resolve of this._pauseWaiters) resolve();
    this._pauseWaiters.clear();
  }

  async validateAll() {
    const result = await this.hierarchyValidator.validateAll();
    this.emit("scan:completed", {
      libraryId: 0,
      libraryName: "validation",
      stats: {
        foldersScanned: result.passed,
        foldersExcluded: 0,
        mediaAdded: 0,
        mediaUpdated: 0,
        mediaSkipped: 0,
        filesSkipped: 0,
        errors: result.violations.map((v: { message: string }) => ({
          type: "general" as const,
          error: v.message,
        })),
      },
      duration: 0,
    });
    return result;
  }
}
