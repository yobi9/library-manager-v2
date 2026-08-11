//  //   تم تغيير من folder-watcher.ts  الىLibraryMonitor اعتمد التغيير
import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";
import { EventEmitter } from "events";
import type { ScannerEventMap } from "./scanner-events";
import type { LibraryRepository } from "../repositories/library-repository";

export class LibraryMonitor extends EventEmitter {
  private watchers = new Map<number, FSWatcher>();
  private eventBuffer = new Map<string, number>();
  private dedupeTTL = 1000;
  private ready = false;
  private _cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private libraryRepo: LibraryRepository) {
    super();
    this._cleanupInterval = setInterval(() => this.cleanupBuffer(), 5 * 60 * 1000);
  }

  override emit<K extends keyof ScannerEventMap>(event: K, data: ScannerEventMap[K]): boolean {
    return super.emit(event as string, data);
  }

  override on<K extends keyof ScannerEventMap>(event: K, listener: (data: ScannerEventMap[K]) => void): this {
    return super.on(event as string, listener as (...args: unknown[]) => void);
  }

  private normalizeEvent(type: string, filePath: string, libraryId: number) {
    const normalized = filePath.replace(/\\/g, "/").trim();
    const key = `${libraryId}:${type}:${normalized}`;
    const now = Date.now();

    const last = this.eventBuffer.get(key);
    if (last && now - last < this.dedupeTTL) return null;

    this.eventBuffer.set(key, now);
    return { type, path: normalized, libraryId, timestamp: now };
  }

  private emitEvent(type: string, filePath: string, libraryId: number) {
    const event = this.normalizeEvent(type, filePath, libraryId);
    if (!event) return;
    this.emit("fs:event", event);
  }

  async watchLibrary(libraryId: number): Promise<void> {
    try {
      const library = await this.libraryRepo.getById(libraryId) as Record<string, unknown> | undefined;
      if (!library) return;
      if (library["isContainer"] || library["is_container"]) return;

      const paths = Array.isArray(library["paths"])
        ? library["paths"] as string[]
        : ((library["paths"] as string) ?? "").split(";").filter(Boolean);

      if (paths.length === 0) return;

      const watcher = chokidar.watch(paths, {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        depth: 8,
        ignorePermissionErrors: true,
        awaitWriteFinish: { stabilityThreshold: 5000, pollInterval: 200 },
      });

      watcher.on("addDir", (dirPath: string) => this.emitEvent("addDir", dirPath, libraryId));
      watcher.on("unlinkDir", (dirPath: string) => this.emitEvent("unlinkDir", dirPath, libraryId));
      watcher.on("add", (filePath: string) => this.emitEvent("addFile", filePath, libraryId));
      watcher.on("change", (filePath: string) => this.emitEvent("change", filePath, libraryId));
      watcher.on("error", (err: unknown) => this.emit("fs:error", { libraryId, message: (err as Error).message, code: (err as NodeJS.ErrnoException).code }));
      watcher.on("ready", () => {
        this.ready = true;
        this.emit("fs:ready", { libraryId, paths });
      });

      this.watchers.set(libraryId, watcher);
    } catch (err) {
      this.emit("fs:error", { libraryId, message: (err as Error).message });
    }
  }

  async unwatchLibrary(libraryId: number): Promise<void> {
    const watcher = this.watchers.get(libraryId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(libraryId);
      this.emit("fs:stopped", { libraryId });
    }
  }

  async unwatchAll(): Promise<void> {
    for (const [id, w] of this.watchers) {
      await w.close();
    }
    this.watchers.clear();
  }

  isWatching(libraryId: number): boolean {
    return this.watchers.has(libraryId);
  }

  private cleanupBuffer() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;
    for (const [key, ts] of this.eventBuffer) {
      if (now - ts > maxAge) this.eventBuffer.delete(key);
    }
    if (this.eventBuffer.size > 1000) {
      const keys = Array.from(this.eventBuffer.keys()).slice(0, 300);
      for (const k of keys) this.eventBuffer.delete(k);
    }
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.unwatchAll().catch(() => {});
    this.removeAllListeners();
  }
}
