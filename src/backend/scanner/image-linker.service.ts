import fs from "fs/promises";
import path from "path";
import { getRetryManager } from "../services/retry-manager";
import { getErrorHandler } from "../services/error-handler";
import type { MediaRepository } from "../repositories/media-repository";
import type { ErrorHandler } from "../services/error-handler";
import type { RetryManager } from "../services/retry-manager";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX = 1000;

interface ImageCacheEntry {
  poster: string | null;
  backdrop: string | null;
  timestamp: number;
}

export class ImageLinkerService {
  private imageCache = new Map<string, ImageCacheEntry>();

  constructor(
    private mediaRepo: MediaRepository,
    private retryManager?: RetryManager,
    private errorHandler?: ErrorHandler,
  ) {
    this.retryManager ??= getRetryManager();
    this.errorHandler ??= getErrorHandler();
  }

  async linkImagesToMedia(
    mediaId: number,
    itemPath: string,
    _itemType: string,
    force = false,
  ): Promise<void> {
    try {
      if (!mediaId || !itemPath) return;

      const images = await this.getImagesForPath(itemPath, force);
      if (!images.poster && !images.backdrop) return;

      const current = await this.mediaRepo.getImageFields(mediaId);

      const updateData: Record<string, unknown> = {};

      if (images.poster) {
        if (!current || !this.isEnrichedPath(current.poster_path as string | null)) {
          updateData["poster_path"] = path.join(itemPath, images.poster);

        }
      }

      if (images.backdrop) {
        if (!current || !this.isEnrichedPath(current.backdrop_path as string | null)) {
          updateData["backdrop_path"] = path.join(itemPath, images.backdrop);

        }
      }

      if (Object.keys(updateData).length === 0) return;

      updateData["updated_at"] = new Date().toISOString();

      await this.retryManager!.executeWithRetry(
        () => this.mediaRepo.update(mediaId, updateData),
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.errorHandler!.logError(err, {
        context: "linkImagesToMedia",
        mediaId,
        itemPath,
      });
    }
  }

  private async getImagesForPath(itemPath: string, force: boolean) {
    const cached = this.imageCache.get(itemPath);
    if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { poster: cached.poster, backdrop: cached.backdrop };
    }

    let poster: string | null = null;
    let backdrop: string | null = null;

    try {
      const entries = await fs.readdir(itemPath, { withFileTypes: true });
      const imageFiles = entries
        .filter((e) => e.isFile() && IMAGE_EXTENSIONS.includes(path.extname(e.name).toLowerCase()))
        .map((e) => e.name);

      if (imageFiles.length === 0) {
        this.imageCache.set(itemPath, { poster: null, backdrop: null, timestamp: Date.now() });
        return { poster: null, backdrop: null };
      }

      for (const img of imageFiles) {
        const lower = img.toLowerCase();
        if (lower.includes("poster") || lower === "folder.jpg" || lower === "cover.jpg") {
          poster = img;
        } else if (lower.includes("backdrop") || lower.includes("fanart") || lower === "background.jpg") {
          backdrop = img;
        }
      }

      if (!backdrop && poster) backdrop = poster;
      if (!poster && imageFiles.length > 0) {
        poster = imageFiles[0] ?? null;
        backdrop = imageFiles[0] ?? null;
      }

      this.pruneCache();
      this.imageCache.set(itemPath, { poster, backdrop, timestamp: Date.now() });

      return { poster, backdrop };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT" || e.code === "EACCES") {
        console.warn(`[ImageLinker] Cannot access path: ${itemPath} (${e.code})`);
      } else {
        const error = err instanceof Error ? err : new Error(String(err));
        await this.errorHandler!.logError(error, { context: "getImagesForPath", itemPath });
      }
      return { poster: null, backdrop: null };
    }
  }

  private isEnrichedPath(filePath: string | null): boolean {
    if (!filePath) return false;
    return filePath.startsWith("/assets/images/enriched/") ||
           filePath.startsWith("public/assets/images/enriched/");
  }

  invalidateCache(itemPath?: string) {
    if (itemPath) {
      this.imageCache.delete(itemPath);
    } else {
      this.imageCache.clear();
    }
  }

  private pruneCache() {
    if (this.imageCache.size > CACHE_MAX) {
      const oldest = Array.from(this.imageCache.keys()).slice(0, Math.floor(CACHE_MAX * 0.2));
      for (const key of oldest) this.imageCache.delete(key);
    }
  }
}
