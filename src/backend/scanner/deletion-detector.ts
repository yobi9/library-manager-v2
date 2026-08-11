import { getDatabase } from "../db/db";
import { getRetryManager } from "../services/retry-manager";
import { getErrorHandler } from "../services/error-handler";
import { normalizeStoragePath } from "../repositories/base-repository";
import { logger } from "../observability/logger";

/**
 * Escapes LIKE metacharacters plus the escape character itself so a root path
 * is matched as a literal prefix (a directory literally named `50% off` must
 * not turn `%` into a wildcard).
 *
 * @param value - Storage-normalized root path (backslashes, lowercase).
 * @returns The value with `\`, `%` and `_` escaped for a `LIKE ? ESCAPE '\'`
 * pattern.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Built result of {@link buildPathPrefixConditions}: the reusable WHERE
 * fragment plus the exact bound patterns, in parameter order.
 */
export interface PathPrefixConditions {
  /** ANDed `column NOT LIKE ? ESCAPE '\'` predicates — one per root. */
  clause: string;
  /** Escaped, `%`-suffixed patterns bound to the clause in order. */
  patterns: string[];
}

/**
 * Builds the WHERE fragment and bound patterns for "column is not under any
 * of the given roots".
 *
 * De Morgan over the roots: an item is kept only when its stored path starts
 * with at least one accessible root, so it is marked unavailable exactly when
 * it fails every prefix — `NOT (col LIKE r1% OR ...)` ≡
 * `col NOT LIKE r1% AND ...`. Each predicate is a constant prefix `LIKE` that
 * executes directly against the indexed column
 * (`idx_media_items_directory` / `idx_media_files_path`).
 *
 * @param column - Indexed path column to test.
 * @param roots - Storage-normalized accessible root paths (deduplicated,
 * non-empty).
 * @returns The clause and its bound patterns.
 */
export function buildPathPrefixConditions(
  column: "directory_path" | "file_path",
  roots: string[],
): PathPrefixConditions {
  const patterns = roots.map((root) => `${escapeLikePattern(root)}%`);
  const clause = patterns.map(() => `${column} NOT LIKE ? ESCAPE '\\'`).join(" AND ");
  return { clause, patterns };
}

/**
 * Normalizes, filters and deduplicates the accessible library roots into the
 * storage form used by the prefix `LIKE` predicates.
 *
 * @param accessiblePaths - Raw root paths from scan preparation (already
 * trimmed by `parseLibraryPaths`; trimmed again here for defense).
 * @returns Deduplicated storage-normalized non-empty roots.
 */
export function normalizeDeletionRoots(accessiblePaths: string[]): string[] {
  return [
    ...new Set(accessiblePaths.map((p) => normalizeStoragePath(p.trim())).filter((p) => p !== "")),
  ];
}

/**
 * Marks media items and their files as unavailable when their stored path is
 * not under any of the library's accessible roots.
 *
 * Purpose: deletion detection after a scan — anything not reachable from the
 * surviving root paths is considered removed from disk.
 *
 * Index strategy: roots are normalized to the storage form
 * (`normalizeStoragePath`) and compared with prefix `LIKE` directly on the
 * indexed columns, replacing the old per-row `LOWER(REPLACE(col))` expression
 * that forced a full scan, and removing the shared `temp_paths` table (which
 * could collide across concurrent scans). A `directory_path IS NOT NULL` guard
 * also prevents legacy rows with no recorded path from being wrongly marked.
 *
 * @param libraryId - Library whose items must be checked.
 * @param accessiblePaths - Library root paths that passed the accessibility
 * probe during scan preparation.
 * @returns The number of media items newly marked unavailable (files are
 * marked too but not counted).
 */
export class DeletionDetector {
  async detectDeleted(
    libraryId: number,
    accessiblePaths: string[],
    scanId?: string,
  ): Promise<{ markedUnavailable: number }> {
    const roots = normalizeDeletionRoots(accessiblePaths);
    if (roots.length === 0) return { markedUnavailable: 0 };
    logger.info("scanner.deletion.started", {
      operationId: scanId ?? null,
      libraryId,
      roots: roots.length,
      accessiblePaths: accessiblePaths.length,
    });

    const itemConds = buildPathPrefixConditions("directory_path", roots);
    const fileConds = buildPathPrefixConditions("file_path", roots);

    const retry = getRetryManager();
    const errorHandler = getErrorHandler();

    try {
      return await retry.executeWithRetry(async () => {
        const db = await getDatabase();

        const itemResult = await db.run(
          `UPDATE media_items
           SET is_available = 0,
               unavailable_since = COALESCE(unavailable_since, CURRENT_TIMESTAMP),
               unavailable_reason = 'path_not_found_during_scan',
               last_seen_path = directory_path,
               updated_at = CURRENT_TIMESTAMP
           WHERE library_id = ?
             AND is_available = 1
             AND directory_path IS NOT NULL
             AND ${itemConds.clause}`,
          [libraryId, ...itemConds.patterns],
        );

        const fileResult = await db.run(
          `UPDATE media_files
           SET is_available = 0,
               unavailable_since = COALESCE(unavailable_since, CURRENT_TIMESTAMP),
               unavailable_reason = 'parent_path_not_found',
               updated_at = CURRENT_TIMESTAMP
           WHERE library_id = ?
             AND is_available = 1
             AND file_path IS NOT NULL
             AND ${fileConds.clause}`,
          [libraryId, ...fileConds.patterns],
        );

        const markedItems = itemResult.changes ?? 0;
        logger.info("scanner.deletion.completed", {
          operationId: scanId ?? null,
          libraryId,
          itemsMarkedUnavailable: markedItems,
          filesMarkedUnavailable: fileResult.changes ?? 0,
        });
        return { markedUnavailable: markedItems };
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("scanner.deletion.error", {
        operationId: scanId ?? null,
        libraryId,
        message: error.message,
      });
      await errorHandler.logError(error, { context: "detectDeleted", libraryId });
      return { markedUnavailable: 0 };
    }
  }
}
