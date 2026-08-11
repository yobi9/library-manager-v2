import fs from "fs/promises";
import path from "path";
import type { Database } from "sqlite";
import { getDatabase, withExclusiveTransaction } from "../db/db";
import type { WalkedItem, SyncResult, MediaRecord, LibraryRecord } from "./scanner-events";
import type { ScanMetrics } from "./scan-metrics";
import type { MediaRepository } from "../repositories/media-repository";
import { MERGABLE_ROOT_TYPES, normalizeTitle } from "../repositories/media-repository";
import type { SnapshotRepository } from "../repositories/snapshot-repository";
import { HierarchyRules } from "./hierarchy-rules";
import { ImageLinkerService } from "./image-linker.service";
import { enhanceEpisodeTitle } from "./title-enhancer";
import { PathValidationService } from "./path-validation.service";
import { logger } from "../observability/logger";
import { getRetryManager } from "../services/retry-manager";
import { getErrorHandler } from "../services/error-handler";

export class MediaSyncService {
  private visitedMediaIds = new Set<number>();
  /**
   * Media IDs that received at least one DB write during the walk (created,
   * updated, reactivated, or gained/changed a file). Visited-but-untouched items
   * are deliberately excluded so `completeScan` only stamps rows that changed —
   * eliminating the redundant `last_scan_id` rewrite on every quick re-scan.
   */
  private writtenMediaIds = new Set<number>();
  /** Parents that gained at least one child during the walk; counts are flushed once per parent. */
  private parentsNeedingCount = new Set<number>();

  /** Active batch SAVEPOINT name, or `null` when the walk is not batched. */
  private batchSavepoint: string | null = null;
  /** Number of items synced inside the current open batch transaction. */
  private batchItemCount = 0;
  /** Item count at which the open batch is committed and a fresh one starts. */
  private batchMaxSize = 1;

  /**
   * Per-item deferred transaction state for the item currently being synced.
   *
   * The nested SAVEPOINT is opened LAZILY — only on the item's first write —
   * so read-only fast-path items (an unchanged file/directory during a quick
   * scan) never open a savepoint. The savepoint must precede the item's first
   * write for per-item rollback to work, which is why every write goes through
   * {@link write} (which opens it). `null` between items.
   */
  private currentItemTx: { db: Database; savepoint: string | null } | null = null;

  constructor(
    private mediaRepo: MediaRepository,
    private snapshotRepo: SnapshotRepository,
    private rules: HierarchyRules,
    private imageLinker: ImageLinkerService,
    private pathValidation: PathValidationService,
    private scanId: string,
    private metrics?: ScanMetrics,
  ) {}

  resetVisited() {
    this.visitedMediaIds.clear();
    this.writtenMediaIds.clear();
    this.parentsNeedingCount.clear();
    this.batchSavepoint = null;
    this.batchItemCount = 0;
  }

  /**
   * Returns the media IDs actually written during this walk.
   *
   * `completeScan` stamps `last_scan_id` only for these rows; visited-but-unchanged
   * items are skipped entirely, removing the write churn on unchanged items during
   * quick re-scans (their `last_scan_id` stays at the previous scan).
   *
   * @returns The mutable set of written media IDs (empty when nothing changed).
   */
  getWrittenIds(): Set<number> {
    return this.writtenMediaIds;
  }

  /**
   * Runs a filesystem walk with every item-sync sharing ONE batch transaction
   * instead of one transaction per item.
   *
   * WHY: the walker drives item-sync one at a time (it needs each directory's
   * media id to recurse), so items cannot be pre-collected into groups. Instead
   * the whole walk runs inside a single `withExclusiveTransaction`, and each
   * item that WRITES commits inside a lazily-opened nested SAVEPOINT (read-only
   * items open none). Every `batchSize` items the batch SAVEPOINT is released —
   * committing those items together — and a fresh batch opens, bounding the
   * transaction size while reducing the commit count from one-per-item to
   * one-per-batch.
   *
   * Failure granularity is unchanged: a failing item rolls back to ITS nested
   * savepoint only; already-committed siblings are untouched and a batch is
   * never partially committed. This preserves the parent/child safety of the
   * old per-item model — the reason batch writes were previously deferred.
   *
   * Lock scope: the exclusive lock is held for the entire walk (the pattern
   * `cleanupOrphanedItems` uses while its SAVEPOINT stays open). During a scan
   * no other savepoint user runs (single active-scan slot; FTS backfill only
   * fires on `scan:completed`, after the walk), so the hold is uncontended.
   *
   * @param fn - The walk (or any item-sync workload) to run inside the batch.
   * @param batchSize - Items per committed batch; clamped to at least 1.
   * @returns The resolved value of `fn`.
   */
  async runBatched<T>(fn: () => Promise<T>, batchSize: number): Promise<T> {
    if (this.batchSavepoint) return fn();
    const db = await getDatabase();
    this.batchMaxSize = Math.max(1, Math.floor(batchSize) || 1);
    this.batchItemCount = 0;
    return withExclusiveTransaction(async () => {
      await this.openBatchSavepoint(db);
      try {
        const result = await fn();
        await this.closeBatchSavepoint(db, { commit: true });
        return result;
      } catch (err) {
        // Fatal walk failure: discard the current open batch so a half-processed
        // group is never committed. Already-flushed batches stay committed.
        await this.closeBatchSavepoint(db, { commit: false });
        throw err;
      }
    });
  }

  /**
   * Runs one item-sync (file or directory) inside a DEFERRED nested SAVEPOINT
   * so all of its DB writes commit as a single unit instead of auto-committing
   * per statement. Rollback is scoped to the failing item only — never to
   * already synced siblings — which keeps parent/child media references intact.
   *
   * The nested SAVEPOINT is opened lazily on the item's first write (see
   * {@link MediaSyncService.write}), so read-only items — the common fast path
   * of a quick scan where nothing changed — never open a savepoint. This cuts
   * `nestedSavepointOpens` from one-per-item to one-per-writing-item without
   * changing failure granularity: an item that writes and then fails still
   * rolls back alone.
   *
   * Two modes:
   * - **Standalone** (no batch active): the item block runs under
   *   `withExclusiveTransaction` so it can never interleave SAVEPOINT commands
   *   with another savepoint transaction (FTS backfill, orphan cleanup).
   * - **Batched** (inside {@link MediaSyncService.runBatched}): the item block
   *   becomes a NESTED savepoint inside the walk's open batch transaction, and
   *   every `batchMaxSize` items the batch commits and reopens.
   *
   * @param operation - The item-sync work to run inside the transaction.
   * @returns The resolved value of the operation.
   */
  private async withItemTransaction<T>(operation: () => Promise<T>): Promise<T> {
    const db = await getDatabase();
    if (this.batchSavepoint) {
      if (this.batchItemCount >= this.batchMaxSize) {
        await this.closeBatchSavepoint(db, { commit: true });
        await this.openBatchSavepoint(db);
      }
      this.batchItemCount++;
      return this.runItemTransaction(db, operation);
    }
    return withExclusiveTransaction(() => this.runItemTransaction(db, operation));
  }

  /**
   * Runs one item-sync inside a lazily-opened nested SAVEPOINT, committing it
   * on success or rolling back to it on failure. The savepoint is opened via
   * {@link MediaSyncService.write} at the item's first write, so a read-only
   * item opens no savepoint and commit/rollback become no-ops.
   *
   * @param db - The active database connection (writer context during a scan).
   * @param operation - The item-sync work to run inside the transaction.
   * @returns The resolved value of the operation.
   */
  private async runItemTransaction<T>(db: Database, operation: () => Promise<T>): Promise<T> {
    const previous = this.currentItemTx;
    this.currentItemTx = { db, savepoint: null };
    try {
      const result = await operation();
      await this.commitItemTransaction(db);
      return result;
    } catch (err) {
      await this.rollbackItemTransaction(db);
      throw err;
    } finally {
      this.currentItemTx = previous;
    }
  }

  /**
   * Opens the current item's nested SAVEPOINT if it is not open yet. Called
   * through {@link MediaSyncService.write} before the item's first write.
   *
   * @param db - The active database connection.
   */
  private async ensureItemTransactionOpen(db: Database): Promise<void> {
    const tx = this.currentItemTx;
    if (!tx || tx.savepoint) return;
    if (this.metrics) this.metrics.nestedSavepointOpens++;
    tx.savepoint = `sp_sync_${this.scanId}_${Math.random().toString(36).substring(2, 8)}`;
    await db.run(`SAVEPOINT ${tx.savepoint}`);
  }

  /**
   * Releases the current item's nested SAVEPOINT, committing its writes. No-op
   * when the item opened no savepoint (read-only item).
   *
   * @param db - The active database connection.
   */
  private async commitItemTransaction(db: Database): Promise<void> {
    const tx = this.currentItemTx;
    if (!tx?.savepoint) return;
    await db.run(`RELEASE SAVEPOINT ${tx.savepoint}`);
    tx.savepoint = null;
  }

  /**
   * Rolls back the current item's nested SAVEPOINT, discarding its writes.
   * No-op when the item opened no savepoint (read-only item).
   *
   * @param db - The active database connection.
   */
  private async rollbackItemTransaction(db: Database): Promise<void> {
    const tx = this.currentItemTx;
    if (!tx?.savepoint) return;
    try {
      await db.run(`ROLLBACK TO SAVEPOINT ${tx.savepoint}`);
    } catch {
      /* ignore */
    }
    try {
      await db.run(`RELEASE SAVEPOINT ${tx.savepoint}`);
    } catch {
      /* ignore */
    }
    tx.savepoint = null;
  }

  /**
   * Runs a DB write inside the current item's transaction, opening the nested
   * SAVEPOINT lazily on the item's first write. Outside an item transaction
   * (e.g. deferred parent-count flushes) the write runs unprotected.
   *
   * @param fn - The write work to run inside the item's savepoint.
   * @returns The resolved value of `fn`.
   */
  private async write<T>(fn: () => Promise<T>): Promise<T> {
    const tx = this.currentItemTx;
    if (!tx) return fn();
    await this.ensureItemTransactionOpen(tx.db);
    return fn();
  }

  /**
   * Opens a fresh batch SAVEPOINT on the current (writer) connection.
   *
   * @param db - The active database connection (writer context during a scan).
   */
  private async openBatchSavepoint(db: Database): Promise<void> {
    const savepoint = `sp_batch_${this.scanId}_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    await db.run(`SAVEPOINT ${savepoint}`);
    this.batchSavepoint = savepoint;
    this.batchItemCount = 0;
  }

  /**
   * Closes the open batch SAVEPOINT: either commits every item written since
   * it opened (`commit: true`) or discards them (`commit: false`).
   *
   * @param db - The active database connection.
   * @param options.commit - Commit the batch (`RELEASE`) or roll it back.
   */
  private async closeBatchSavepoint(db: Database, options: { commit: boolean }): Promise<void> {
    const savepoint = this.batchSavepoint;
    if (!savepoint) return;
    this.batchSavepoint = null;
    this.batchItemCount = 0;
    if (options.commit) {
      if (this.metrics) this.metrics.batchCommits++;
      await db.run(`RELEASE SAVEPOINT ${savepoint}`);
    } else {
      if (this.metrics) this.metrics.batchRollbacks++;
      try {
        await db.run(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      } catch {
        /* ignore */
      }
      await db.run(`RELEASE SAVEPOINT ${savepoint}`);
    }
  }

  /**
   * Defers the parent child-count refresh until the end of the walk, so one
   * COUNT + UPDATE runs per parent instead of per created child.
   *
   * @param parentMediaId - Parent whose available children should be recounted.
   */
  private markParentCountDirty(parentMediaId: number) {
    this.parentsNeedingCount.add(parentMediaId);
  }

  /**
   * Applies the deferred child-count refreshes collected during the walk.
   * Called by the orchestrator once the filesystem walk finishes.
   */
  async flushParentCounts(): Promise<void> {
    if (this.parentsNeedingCount.size === 0) return;
    const retry = getRetryManager();
    for (const parentMediaId of this.parentsNeedingCount) {
      await retry.executeWithRetry(() => this.mediaRepo.updateParentChildrenCount(parentMediaId));
    }
    this.parentsNeedingCount.clear();
  }

  async syncDirectory(
    item: WalkedItem,
    library: LibraryRecord,
    isDeepScan: boolean,
  ): Promise<SyncResult> {
    const startedAt = Date.now();
    let ok = false;
    try {
      const result = await this.withItemTransaction(() =>
        this.syncDirectoryCore(item, library, isDeepScan),
      );
      ok = true;
      return result;
    } finally {
      this.metrics?.recordDirSync(Date.now() - startedAt, ok);
    }
  }

  private async syncDirectoryCore(
    item: WalkedItem,
    library: LibraryRecord,
    isDeepScan: boolean,
  ): Promise<SyncResult> {
    const normalizedPath = this.pathValidation.normalizeForDb(item.path);

    let existing: MediaRecord | null | undefined;
    const cacheKey = `${library.library_id}:${normalizedPath}:${item.itemType}`;

    if (isDeepScan) {
      existing = (await this.mediaRepo.getByPath(
        normalizedPath,
        library.library_id,
      )) as MediaRecord | null;
    } else {
      existing = (await this.mediaRepo.findExisting({
        title: item.name,
        library_id: library.library_id,
        type: item.itemType!,
        parent_media_id: item.parentMediaId,
        directory_path: normalizedPath,
      })) as MediaRecord | null;
    }

    if (!existing && item.isRootFolder && MERGABLE_ROOT_TYPES.has(item.itemType ?? "")) {
      const duplicate = await this.mediaRepo.findDuplicate({
        library_id: library.library_id,
        type: item.itemType!,
        normalized_title: normalizeTitle(item.name),
        parent_media_id: null,
      });
      if (duplicate) {
        existing = (await this.mediaRepo.getById(
          duplicate["media_id"] as number,
        )) as MediaRecord | null;
      }
    }

    if (existing) {
      let needsUpdate = false;

      if (isDeepScan) {
        try {
          const stats = await fs.stat(item.path);
          const existingTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
          needsUpdate = stats.mtime.getTime() > existingTime;
        } catch {
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        const retry = getRetryManager();
        await this.write(() =>
          retry.executeWithRetry(() =>
            this.mediaRepo.update(existing!.media_id, {
              updated_at: new Date().toISOString(),
              last_scan_id: this.scanId,
              is_available: 1,
              unavailable_since: null,
              unavailable_reason: null,
            }),
          ),
        );
        if (isDeepScan && !item.parentMediaId) {
          await this.write(() =>
            this.imageLinker.linkImagesToMedia(existing.media_id, item.path, item.itemType!, true),
          );
        }
        this.visitedMediaIds.add(existing.media_id);
        this.writtenMediaIds.add(existing.media_id);
        logger.debug("scanner.sync.dir_updated", {
          operationId: this.scanId,
          mediaId: existing.media_id,
          path: normalizedPath,
        });
        return { mediaId: existing.media_id, isNew: false, isUpdated: true };
      }

      if (!existing.is_available) {
        const retry = getRetryManager();
        await this.write(() =>
          retry.executeWithRetry(() =>
            this.mediaRepo.update(existing!.media_id, {
              is_available: 1,
              unavailable_since: null,
              unavailable_reason: null,
              updated_at: new Date().toISOString(),
            }),
          ),
        );
        logger.debug("scanner.sync.dir_reactivated", {
          operationId: this.scanId,
          mediaId: existing.media_id,
          path: normalizedPath,
        });
        this.writtenMediaIds.add(existing.media_id);
      }

      this.visitedMediaIds.add(existing.media_id);
      return { mediaId: existing.media_id, isNew: false, isUpdated: false };
    }

    const yearFromDir = this.extractYear(item.name) || this.extractYear(item.path);

    const itemData: Record<string, unknown> = {
      title: item.name,
      type: item.itemType,
      parent_media_id: item.parentMediaId,
      library_id: library.library_id,
      directory_path: item.path,
      hierarchical_level: item.depth,
      is_leaf: 0,
      is_available: 1,
      year: yearFromDir,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return this.createWithHierarchy(itemData, item, library);
  }

  async syncFile(
    item: WalkedItem,
    library: LibraryRecord,
    parentMediaId: number,
    isDeepScan: boolean,
  ): Promise<SyncResult> {
    const startedAt = Date.now();
    let ok = false;
    try {
      const result = await this.withItemTransaction(() =>
        this.syncFileCore(item, library, parentMediaId, isDeepScan),
      );
      ok = true;
      return result;
    } finally {
      this.metrics?.recordFileSync(Date.now() - startedAt, ok);
    }
  }

  private async syncFileCore(
    item: WalkedItem,
    library: LibraryRecord,
    parentMediaId: number,
    isDeepScan: boolean,
  ): Promise<SyncResult> {
    const normalizedPath = this.pathValidation.normalizeForDb(item.path);
    const mimeType = this.getMimeType(item.name);
    const retry = getRetryManager();

    const isMovieFile = library.type === "movie" && item.depth === 1 && parentMediaId;
    if (isMovieFile) {
      const parentMedia = (await this.mediaRepo.getById(parentMediaId)) as MediaRecord | null;
      if (parentMedia && parentMedia.type === "movie") {
        const existingFile = (await this.mediaRepo.getFileByPath(
          normalizedPath,
          library.library_id,
        )) as Record<string, unknown> | null;

        if (existingFile) {
          if (isDeepScan) {
            const stats = await fs.stat(item.path);
            let needsUpdate = existingFile["file_size"] !== stats.size;
            if (!needsUpdate && existingFile["updated_at"]) {
              const existingTime = new Date(existingFile["updated_at"] as string).getTime();
              needsUpdate = stats.mtime.getTime() > existingTime;
            }
            if (needsUpdate) {
              await this.write(() =>
                this.mediaRepo.updateFile(existingFile["file_id"] as number, {
                  file_size: stats.size,
                  mime_type: mimeType,
                  updated_at: new Date().toISOString(),
                  is_available: 1,
                }),
              );
              this.writtenMediaIds.add(parentMediaId);
              return { mediaId: parentMediaId, isNew: false, isUpdated: true };
            }
          }
          if (existingFile["is_available"] === 0) {
            await this.write(() =>
              this.mediaRepo.updateFile(existingFile["file_id"] as number, {
                is_available: 1,
                updated_at: new Date().toISOString(),
              }),
            );
            logger.debug("scanner.sync.file_reactivated_movie", {
              operationId: this.scanId,
              mediaId: parentMediaId,
              path: normalizedPath,
            });
            this.writtenMediaIds.add(parentMediaId);
          }
          return { mediaId: parentMediaId, isNew: false, isUpdated: false };
        }

        if (isDeepScan) {
          const stats = await fs.stat(item.path);
          await this.write(() =>
            this.mediaRepo.createFile({
              media_id: parentMediaId,
              library_id: library.library_id,
              file_path: normalizedPath,
              file_size: stats.size,
              mime_type: mimeType,
              duration: null,
              is_available: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
          );
          this.writtenMediaIds.add(parentMediaId);
          return { mediaId: parentMediaId, isNew: true, isUpdated: false };
        }

        return { mediaId: parentMediaId, isNew: false, isUpdated: false };
      }
    }

    const existingFile = (await retry.executeWithRetry(() =>
      this.mediaRepo.getFileByPath(normalizedPath, library.library_id),
    )) as Record<string, unknown> | null;

    if (existingFile) {
      // الملف موجود مسبقاً: نعتبره (وعنصر الوسائط المالك له) تمّت زيارته حتى
      // يظل عنصر الحلقة متاحاً (is_available=1) عبر completeScan — كان يُعاد
      // تفعيل الملف فقط ويبقى عنصر الحلقة "غير متاح" رغم وجود ملفه.
      this.visitedMediaIds.add(existingFile["media_id"] as number);

      if (isDeepScan) {
        const stats = await fs.stat(item.path);
        let needsUpdate = existingFile["file_size"] !== stats.size;
        if (!needsUpdate && existingFile["updated_at"]) {
          const existingTime = new Date(existingFile["updated_at"] as string).getTime();
          needsUpdate = stats.mtime.getTime() > existingTime;
        }
        if (needsUpdate) {
          await this.write(() =>
            this.mediaRepo.updateFile(existingFile["file_id"] as number, {
              file_size: stats.size,
              updated_at: new Date().toISOString(),
            }),
          );
          logger.debug("scanner.sync.file_updated", {
            operationId: this.scanId,
            mediaId: existingFile["media_id"] as number,
            path: normalizedPath,
          });
          this.writtenMediaIds.add(existingFile["media_id"] as number);
          return { mediaId: existingFile["media_id"] as number, isNew: false, isUpdated: true };
        }
      }
      if (existingFile["is_available"] === 0) {
        await this.write(() =>
          this.mediaRepo.updateFile(existingFile["file_id"] as number, {
            is_available: 1,
            updated_at: new Date().toISOString(),
          }),
        );
        logger.debug("scanner.sync.file_reactivated", {
          operationId: this.scanId,
          mediaId: existingFile["media_id"] as number,
          path: normalizedPath,
        });
        this.writtenMediaIds.add(existingFile["media_id"] as number);
      }
      return { mediaId: existingFile["media_id"] as number, isNew: false, isUpdated: false };
    }

    const stats = await fs.stat(item.path);
    const isLeafType =
      item.itemType === "episode" ||
      item.itemType === "song" ||
      (library.type === "movie" && item.depth === 0) ||
      this.rules.isLeafType(item.itemType!);

    let mediaId = parentMediaId;

    if (isLeafType) {
      const defaultTitle = path.basename(item.name, path.extname(item.name));
      const enhancedTitle = enhanceEpisodeTitle(item.path, library.type, item.depth, defaultTitle);
      const yearFromFile = this.extractYear(item.name) || this.extractYear(item.path);

      const leafData: Record<string, unknown> = {
        title: enhancedTitle,
        type: item.itemType,
        parent_media_id: parentMediaId,
        library_id: library.library_id,
        directory_path: item.parentPath,
        hierarchical_level: item.depth,
        is_leaf: 1,
        is_available: 1,
        year: yearFromFile,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = (await this.write(() => this.mediaRepo.createMedia(leafData))) as Record<
        string,
        unknown
      >;
      mediaId = (result["media_id"] ?? result["id"]) as number;
      if (!mediaId) throw new Error("Failed to create media item for file");
      this.visitedMediaIds.add(mediaId);
      this.writtenMediaIds.add(mediaId);
    }

    if (!mediaId) throw new Error(`Cannot determine media_id for file: ${item.path}`);

    await this.write(() =>
      this.mediaRepo.createFile({
        media_id: mediaId,
        library_id: library.library_id,
        file_path: normalizedPath,
        file_size: stats.size,
        mime_type: mimeType,
        duration: null,
        is_available: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    );
    this.writtenMediaIds.add(mediaId);

    if (parentMediaId) {
      this.markParentCountDirty(parentMediaId);
    }
    logger.debug("scanner.sync.file_created", {
      operationId: this.scanId,
      mediaId,
      path: normalizedPath,
    });

    return { mediaId, isNew: true, isUpdated: false };
  }

  private async createWithHierarchy(
    itemData: Record<string, unknown>,
    item: WalkedItem,
    library: LibraryRecord,
  ): Promise<SyncResult> {
    const retry = getRetryManager();
    const errorHandler = getErrorHandler();

    try {
      const result = await this.write(() =>
        retry.executeWithRetry(() => this.mediaRepo.createMedia(itemData)),
      );
      const mediaId = ((result as Record<string, unknown>)["media_id"] ??
        (result as Record<string, unknown>)["id"]) as number;
      if (!mediaId) throw new Error("Failed to extract media ID after creation");

      if (item.parentMediaId) {
        this.markParentCountDirty(item.parentMediaId);
      }

      this.visitedMediaIds.add(mediaId);
      this.writtenMediaIds.add(mediaId);

      if (!item.parentMediaId) {
        await this.write(() =>
          this.imageLinker.linkImagesToMedia(mediaId, item.path, item.itemType!, false),
        );
      }
      logger.debug("scanner.sync.dir_created", {
        operationId: this.scanId,
        mediaId,
        path: item.path,
      });

      return { mediaId, isNew: true, isUpdated: false };
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === "SQLITE_CONSTRAINT") {
        const normalized = this.pathValidation.normalizeForDb(item.path);
        const existing = (await this.mediaRepo.getByPath(
          normalized,
          library.library_id,
        )) as MediaRecord | null;
        if (existing) {
          await this.write(() =>
            this.mediaRepo.update(existing.media_id, {
              updated_at: new Date().toISOString(),
              last_scan_id: this.scanId,
              is_available: 1,
            }),
          );
          this.visitedMediaIds.add(existing.media_id);
          this.writtenMediaIds.add(existing.media_id);
          return { mediaId: existing.media_id, isNew: false, isUpdated: true };
        }
      }
      await errorHandler.logError(e, { context: "createWithHierarchy", itemPath: item.path });
      throw err;
    }
  }

  /**
   * Extracts the trailing 4-digit year (1900..current year) from a file or directory name.
   *
   * Future years (e.g. an in-universe year such as 2045/2099 inside a title) are NOT
   * treated as release years and are rejected, so they never pollute the year taxonomy.
   *
   * @param text - File/directory name or path to scan for a year pattern.
   * @returns The last matched year within [1900, currentYear], or `null` when none is valid.
   */
  private extractYear(text: string): number | null {
    if (!text) return null;
    const matches = [...text.matchAll(/\b(19|20)\d{2}\b/g)];
    if (matches.length === 0) return null;
    const last = parseInt(matches[matches.length - 1]![0], 10);
    const currentYear = new Date().getFullYear();
    return last >= 1900 && last <= currentYear ? last : null;
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const map: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".mp3": "audio/mpeg",
      ".flac": "audio/flac",
      ".wav": "audio/wav",
      ".m4a": "audio/mp4",
      ".webm": "video/webm",
    };
    return map[ext] || "application/octet-stream";
  }
}
