import fs from "fs/promises";
import type { Dir, Dirent } from "fs";
import path from "path";
import type { WalkedItem, WalkResult, LibraryRecord } from "./scanner-events";
import type { HierarchyRules } from "./hierarchy-rules";
import { PathValidationService } from "./path-validation.service";
import { logger } from "../observability/logger";

const SKIP_DIRECTORIES = new Set([
  "@eaDir",
  ".DS_Store",
  "Thumbs.db",
  "$RECYCLE.BIN",
  "System Volume Information",
  "pagefile.sys",
]);

/**
 * Exclusion marker files (matched case-insensitively).
 *
 * A directory — including a library root — that contains any of these markers
 * is skipped entirely by the walker. The marker blocks FUTURE indexing only:
 * items already present in the database are left untouched (`is_available`
 * is not affected).
 */
const EXCLUSION_MARKERS = new Set([".ignore", ".nomedia"]);

/**
 * Checks whether a directory entry name is an exclusion marker
 * (`.ignore` / `.nomedia`), matched case-insensitively (e.g. `.NOMEDIA`).
 *
 * @param name - The directory entry name to test.
 * @returns True when the name is an exclusion marker, false otherwise.
 */
export function isExclusionMarker(name: string): boolean {
  return EXCLUSION_MARKERS.has(name.toLowerCase());
}

const SKIP_EXTENSIONS = new Set([
  ".txt",
  ".nfo",
  ".srt",
  ".sub",
  ".log",
  ".tmp",
  ".db",
  ".ini",
  ".cfg",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
  ".ico",
  ".html",
  ".htm",
  ".xml",
  ".json",
  ".css",
  ".js",
  ".md",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bat",
  ".sh",
  ".ps1",
]);

const ROOT_TYPES = new Set([
  "series",
  "movie",
  "theater",
  "music",
  "singer",
  "series_anime",
  "series_sports",
  "series_deen",
  "series_doc",
  "series_ramadan",
  "series_tv",
  "series_learn",
  "series_kids",
  "audio_deen",
  "main",
  "main_auto",
  "vidsSameFolder",
  "appsSameFolder",
  "audioSameFolder",
  "booksSameFolder",
]);

const MIME_MAP: Record<string, string> = {
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

export interface WalkerConfig {
  maxDepth: number;
  batchDelayMs: number;
  enableFileScan: boolean;
}

/**
 * Walks a library's filesystem paths depth-first.
 * For each directory/file, calls onItem and uses its return value as the
 * mediaId for recursing into subdirectories.
 */
export class DirectoryWalker {
  private _aborted = false;

  constructor(
    private rules: HierarchyRules,
    private pathValidation: PathValidationService,
    private config: WalkerConfig,
  ) {}

  abort() {
    this._aborted = true;
  }
  reset() {
    this._aborted = false;
  }

  async walk(
    library: LibraryRecord,
    onItem: (item: WalkedItem) => Promise<number | null | undefined>,
    onPause?: () => Promise<void>,
  ): Promise<WalkResult> {
    this._aborted = false;
    const result: WalkResult = {
      foldersScanned: 0,
      filesScanned: 0,
      foldersSkipped: 0,
      filesSkipped: 0,
      foldersExcluded: 0,
      excludedPaths: [],
    };
    const libraryPaths = this.pathValidation.parseLibraryPaths(library);
    for (const lp of libraryPaths) {
      await this.walkPath(lp, library, 0, null, result, onItem, onPause);
    }
    return result;
  }

  private async walkPath(
    dirPath: string,
    library: LibraryRecord,
    depth: number,
    parentMediaId: number | null,
    result: WalkResult,
    onItem: (item: WalkedItem) => Promise<number | null | undefined>,
    onPause?: () => Promise<void>,
  ): Promise<void> {
    if (this._aborted) return;
    if (onPause) await onPause();
    if (this._aborted) return;
    if (!this.pathValidation.isPathAllowedForLibrary(dirPath, library)) return;
    if (depth > this.config.maxDepth) return;

    if (depth === 0) {
      const rootEntries = await this.readDirEntries(dirPath);
      if (rootEntries && rootEntries.some((e) => isExclusionMarker(e.name))) {
        result.foldersExcluded++;
        result.excludedPaths.push(dirPath);
        logger.debug("walker.root_excluded", { path: dirPath });
        return;
      }
    }

    let dir: Dir | null = null;
    try {
      dir = await fs.opendir(dirPath);
      let entry: Dirent | null;
      while ((entry = await dir.read()) !== null) {
        if (this._aborted) break;

        if (entry.isSymbolicLink()) continue;

        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (SKIP_DIRECTORIES.has(entry.name)) {
            result.foldersSkipped++;
            logger.debug("walker.skipped_dir", { name: entry.name, path: entryPath });
            continue;
          }

          const childEntries = await this.readDirEntries(entryPath);
          if (!childEntries || childEntries.length === 0) {
            result.foldersSkipped++;
            logger.debug("walker.empty_dir", { path: entryPath });
            continue;
          }
          if (childEntries.some((e) => isExclusionMarker(e.name))) {
            result.foldersExcluded++;
            result.excludedPaths.push(entryPath);
            logger.debug("walker.excluded_dir", { path: entryPath });
            continue;
          }

          let itemType = this.rules.resolveType({
            libraryType: library.type,
            depth,
            isFile: false,
          });
          if (!itemType) {
            result.foldersSkipped++;
            logger.debug("walker.untyped_dir", { path: entryPath });
            await this.walkPath(
              entryPath,
              library,
              depth + 1,
              parentMediaId,
              result,
              onItem,
              onPause,
            );
            continue;
          }
          itemType = itemType || library.type;
          const isRootFolder = ROOT_TYPES.has(itemType) && depth === 0;

          const item: WalkedItem = {
            name: entry.name,
            path: entryPath,
            parentPath: dirPath,
            depth,
            isFile: false,
            itemType,
            isRootFolder,
            parentMediaId,
          };
          const newMediaId = (await onItem(item)) ?? parentMediaId;
          result.foldersScanned++;

          if (this.config.batchDelayMs > 0)
            await new Promise((r) => setTimeout(r, this.config.batchDelayMs));

          if (itemType !== null) {
            await this.walkPath(entryPath, library, depth + 1, newMediaId, result, onItem, onPause);
          }
        } else if (entry.isFile() && this.config.enableFileScan) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SKIP_EXTENSIONS.has(ext)) {
            result.filesSkipped++;
            logger.debug("walker.skipped_file_ext", { ext, name: entry.name });
            continue;
          }

          const mime = MIME_MAP[ext];
          if (!mime?.startsWith("video/") && !mime?.startsWith("audio/")) {
            result.filesSkipped++;
            logger.debug("walker.skipped_non_media", { name: entry.name });
            continue;
          }

          const itemType = this.rules.resolveType({
            libraryType: library.type,
            depth,
            isFile: true,
          });
          if (!itemType) {
            result.filesSkipped++;
            logger.debug("walker.untyped_file", { name: entry.name, path: entryPath });
            continue;
          }

          const item: WalkedItem = {
            name: entry.name,
            path: entryPath,
            parentPath: dirPath,
            depth,
            isFile: true,
            itemType,
            isRootFolder: false,
            parentMediaId,
          };
          await onItem(item);
          result.filesScanned++;
        }
      }
    } catch (err) {
      logger.warn("walker.error", { path: dirPath, message: (err as Error).message });
    } finally {
      if (dir)
        try {
          await dir.close();
        } catch {
          /* ok */
        }
    }
  }

  private async readDirEntries(dirPath: string): Promise<Dirent[] | null> {
    try {
      return await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return null;
    }
  }
}
