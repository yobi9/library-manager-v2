import fs from "fs/promises";
import { getRetryManager } from "../services/retry-manager";
import type { LibraryRecord } from "./scanner-events";

export class PathValidationService {
  private pathCache = new Map<string, string>();

  normalizePath(originalPath: string): string {
    if (this.pathCache.has(originalPath)) {
      return this.pathCache.get(originalPath)!;
    }

    let p = originalPath.trim();
    if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
    if (p.endsWith("\\")) p = p.slice(0, -1);
    p = p.replace(/\//g, "\\");

    const normalized = p;
    this.pathCache.set(originalPath, normalized);
    return normalized;
  }

  normalizeForDb(filePath: string): string {
    return filePath.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "").toLowerCase();
  }

  async checkPathAccessibility(p: string): Promise<{
    accessible: boolean;
    itemCount?: number;
    message?: string;
    error?: string;
    code?: string;
  }> {
    const retry = getRetryManager();
    try {
      return await retry.executeWithRetry(async () => {
        await fs.access(p);
        const items = await fs.readdir(p, { withFileTypes: true });
        return {
          accessible: true,
          itemCount: items.length,
          message: "Path is accessible and readable",
        };
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      return {
        accessible: false,
        error: err.message,
        code: err.code,
      };
    }
  }

  isPathAllowedForLibrary(fullPath: string, library: LibraryRecord): boolean {
    if (!library.paths) return false;
    const paths = Array.isArray(library.paths) ? library.paths : library.paths.split(";").filter(Boolean);
    if (paths.length === 0) return false;
    const normalized = this.normalizeForDb(fullPath);
    return paths.some((allowed) => {
      const na = this.normalizeForDb(allowed);
      return normalized === na || normalized.startsWith(na + "/");
    });
  }

  async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  parseLibraryPaths(library: LibraryRecord): string[] {
    let paths: string[] = [];
    if (Array.isArray(library.paths)) {
      paths = library.paths
        .filter((p: string) => p && p.trim())
        .map((p: string) => this.normalizePath(p.trim()));
    } else if (typeof library.paths === "string") {
      paths = library.paths
        .split(";")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => this.normalizePath(p));
    }
    return paths;
  }

  clearCache() {
    this.pathCache.clear();
  }
}
