import crypto from "crypto";
import { getEventBus } from "./event-bus";
import { ActivityRepository } from "../repositories/activity-repository";

interface CacheEntry {
  data: unknown;
  expiresAt: number;
  createdAt: number;
}

interface CacheSettings {
  enabled: boolean;
  defaultTTL: number;
  staleTTL: number;
  longTTL: number;
  maxSize: number;
  cleanupInterval: number;
  enableLRU: boolean;
  enableCacheWarming: boolean;
  memoryThreshold: number;
  enableMemoryMonitoring: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  staleUses: number;
  hitRate: string;
  size: number;
  maxSize: number;
  memoryUsage: string;
}

export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>();
  private eventBus = getEventBus();

  private settings: CacheSettings = {
    enabled: true,
    defaultTTL: 300,
    staleTTL: 86400,
    longTTL: 604800,
    maxSize: 5000,
    cleanupInterval: 60,
    enableLRU: true,
    enableCacheWarming: true,
    memoryThreshold: 500,
    enableMemoryMonitoring: true,
  };

  private stats: Omit<CacheStats, "hitRate" | "size" | "maxSize" | "memoryUsage"> = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    staleUses: 0,
  };

  private _cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private _memoryInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private activityRepo: ActivityRepository) {
    this._startCleanupInterval();
    if (this.settings.enableMemoryMonitoring) {
      this._startMemoryMonitoring();
    }
  }

  getTTL(tier: "short" | "medium" | "long" = "short"): number {
    switch (tier) {
      case "short":
        return this.settings.defaultTTL;
      case "medium":
        return this.settings.staleTTL;
      case "long":
        return this.settings.longTTL;
    }
  }

  private _normalizeTTL(ttl?: number | string | null): number {
    if (ttl === undefined || ttl === null) return this.settings.defaultTTL * 1000;
    if (typeof ttl === "number") return ttl * 1000;
    const parsed = parseInt(ttl, 10);
    return isNaN(parsed) ? this.settings.defaultTTL * 1000 : parsed * 1000;
  }

  generateKey(prefix: string, params: Record<string, unknown> = {}): string {
    try {
      const paramString = JSON.stringify(params);
      const hash = crypto.createHash("md5").update(paramString).digest("hex");
      return `${prefix}:${hash}`;
    } catch {
      return `${prefix}:${Date.now()}:${Math.random()}`;
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (!cached) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.evictions++;
      this.eventBus.emit("cache_item_expired", { key });
      return null;
    }

    if (this.settings.enableLRU) {
      this.accessOrder.delete(key);
      this.accessOrder.set(key, Date.now());
    }

    this.stats.hits++;
    return cached.data as T;
  }

  async set(key: string, data: unknown, ttl?: number | string | null): Promise<boolean> {
    if (data === undefined) return false;
    if (!this.settings.enabled) return false;

    const ttlMs = this._normalizeTTL(ttl);
    if (this.cache.size >= this.settings.maxSize) {
      const toEvict = Math.max(1, Math.floor(this.cache.size * 0.1));
      this._evictLRU(toEvict);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });

    if (this.settings.enableLRU) {
      this.accessOrder.delete(key);
      this.accessOrder.set(key, Date.now());
    }

    this.stats.sets++;
    return true;
  }

  async has(key: string): Promise<boolean> {
    const cached = this.cache.get(key);
    if (!cached) return false;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.evictions++;
      return false;
    }
    return true;
  }

  async delete(key: string): Promise<number> {
    const staleKey = `${key}:stale`;
    const deleted = (this.cache.delete(key) ? 1 : 0) + (this.cache.delete(staleKey) ? 1 : 0);
    if (deleted > 0) {
      this.accessOrder.delete(key);
      this.accessOrder.delete(staleKey);
      this.stats.deletes += deleted;
    }
    return deleted;
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${prefix}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
    this.stats.deletes += keysToDelete.length;
    if (keysToDelete.length > 0) {
      this.eventBus.emit("cache_bulk_delete", { prefix, count: keysToDelete.length });
    }
    return keysToDelete.length;
  }

  async deleteByPattern(pattern: string): Promise<number> {
    if (!pattern || pattern.length > 200) {
      console.warn("[Cache] deleteByPattern: pattern too long or empty, skipping");
      return 0;
    }

    if (!pattern.includes("*") || pattern.split("*").length <= 3) {
      const prefix = pattern.replace(/\*/g, "");
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) keysToDelete.push(key);
      }
      for (const key of keysToDelete) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
      }
      this.stats.deletes += keysToDelete.length;
      if (keysToDelete.length > 0) {
        this.eventBus.emit("cache_bulk_delete", { pattern, count: keysToDelete.length });
      }
      return keysToDelete.length;
    }

    const escapeRegex = (str: string) => str.replace(/[.*+?^=!:${}()|[\]/\\]/g, "\\$&");
    const escapedPattern = escapeRegex(pattern).replace(/\\\*/g, ".*");

    const starCount = (escapedPattern.match(/\.\*/g) || []).length;
    if (starCount > 10) {
      console.warn("[Cache] deleteByPattern: pattern too complex, skipping");
      return 0;
    }

    const regex = new RegExp(escapedPattern);
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (regex.test(key)) keysToDelete.push(key);
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
    this.stats.deletes += keysToDelete.length;
    if (keysToDelete.length > 0) {
      this.eventBus.emit("cache_bulk_delete", { pattern, count: keysToDelete.length });
    }
    return keysToDelete.length;
  }

  async setMany(entries: [string, unknown][], ttl?: number | string | null): Promise<number> {
    let count = 0;
    for (const [key, data] of entries) {
      const ok = await this.set(key, data, ttl);
      if (ok) count++;
    }
    return count;
  }

  async getMany<T = unknown>(keys: string[]): Promise<Map<string, T>> {
    const map = new Map<string, T>();
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        map.set(key, value);
      }
    }
    return map;
  }

  async setStale(prefix: string, params: Record<string, unknown>, data: unknown): Promise<boolean> {
    const key = this.generateKey(prefix, params) + ":stale";
    return this.set(key, data, this.settings.staleTTL);
  }

  async getStale<T = unknown>(prefix: string, params: Record<string, unknown>): Promise<T | null> {
    const key = this.generateKey(prefix, params) + ":stale";
    return this.get<T>(key);
  }

  async withCache<T>(
    prefix: string,
    params: Record<string, unknown>,
    fetchFunction: () => Promise<T>,
    ttl?: number | null,
  ): Promise<T> {
    const key = this.generateKey(prefix, params);
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    try {
      const data = await fetchFunction();
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttl);
        if (ttl !== null && ttl !== undefined && ttl >= 60) {
          await this.setStale(prefix, params, data);
        }
      }
      return data;
    } catch (error) {
      if (!this.settings.enableCacheWarming) throw error;
      const staleData = await this.getStale<T>(prefix, params);
      if (staleData !== null) {
        this.stats.staleUses++;
        this.eventBus.emit("cache_stale_used", {
          prefix,
          params,
          error: error instanceof Error ? error.message : String(error),
        });
        return staleData;
      }
      throw error;
    }
  }

  private _evictLRU(count: number): number {
    if (this.cache.size === 0) return 0;

    const toEvict: string[] = [];
    for (const key of this.accessOrder.keys()) {
      if (toEvict.length >= count) break;
      toEvict.push(key);
    }

    for (const key of toEvict) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.evictions++;
    }

    if (toEvict.length > 0) {
      this.eventBus.emit("cache_eviction", {
        count: toEvict.length,
        keys: toEvict.slice(0, 10),
      });
    }

    return toEvict.length;
  }

  private _cleanupExpired(): void {
    const now = Date.now();
    const expired: string[] = [];
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) expired.push(key);
    }
    for (const key of expired) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
    if (expired.length) {
      this.stats.evictions += expired.length;
      this.eventBus.emit("cache_cleanup", { expiredCount: expired.length });
    }
  }

  private _startCleanupInterval(): void {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    this._cleanupInterval = setInterval(
      () => this._cleanupExpired(),
      this.settings.cleanupInterval * 1000,
    );
    this._cleanupInterval.unref();
  }

  private _startMemoryMonitoring(): void {
    if (this._memoryInterval) clearInterval(this._memoryInterval);
    this._memoryInterval = setInterval(() => this._monitorMemory(), 30000);
    this._memoryInterval.unref();
  }

  private _monitorMemory(): void {
    const usage = process.memoryUsage().heapUsed / 1024 / 1024;
    const threshold = this.settings.memoryThreshold;

    // لا نسجّل تنبيهات الذاكرة في جدول الأنشطة (كانت تغرق صندوق "أحداث النظام"
    // بآلاف الصفوف كل ثانية) — نكتفي بالبث اللحظي عبر SSE لمراقبة حية دون ضجيج.
    if (usage > threshold) {
      const message = `Critical: Memory usage too high (${usage.toFixed(0)}MB)`;
      this.eventBus.emit("system_alert", {
        type: "critical",
        message,
      });

      const toEvict = Math.floor(this.cache.size * 0.2);
      if (toEvict > 0) {
        this._evictLRU(toEvict);
      }
    } else if (usage > threshold * 0.7) {
      this.eventBus.emit("system_alert", {
        type: "warning",
        message: `Memory usage elevated (${usage.toFixed(0)}MB)`,
      });
    }
  }

  async notifyDbSaved(sizeInMb: number): Promise<void> {
    this.eventBus.emit("system_alert", {
      type: "success",
      message: `Database saved to disk. Size: ${sizeInMb}MB`,
    });
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : "0";
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.settings.maxSize,
      memoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + " MB",
    };
  }

  async clear(): Promise<number> {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0, staleUses: 0 };
    this.eventBus.emit("cache_cleared", { size });
    return size;
  }

  dispose(): void {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    if (this._memoryInterval) {
      clearInterval(this._memoryInterval);
      this._memoryInterval = null;
    }
    this.cache.clear();
    this.accessOrder.clear();
  }
}

/** مفتاح تخزين مثيل الكاش على `globalThis`. */
const CACHE_INSTANCE_STATE_KEY = "__libraryManagerCacheInstance";

const globalCacheInstance = (globalThis as Record<string, unknown>)[CACHE_INSTANCE_STATE_KEY] as
  CacheService | null | undefined;

let _cacheInstance: CacheService | null = globalCacheInstance ?? null;

/**
 * يُنشئ مثيل الكاش الوحيد أو يسترجع الموجود.
 *
 * يُحفظ على `globalThis` بدل حالة الوحدة (نفس سبب `getServices()`): إعادة تقييم
 * الوحدة في وضع التطوير كانت تُنشئ مثيلاً جديداً يمسح الكاش المشترك ويشغّل
 * مؤقّتي تنظيف مكرّرين لكل إعادة ترجمة.
 *
 * @param activityRepo - مستودع الأنشطة المستخدم عند الإنشاء الأول فقط.
 * @returns مثيل الكاش الوحيد للعملية الحالية.
 */
export function getCacheService(activityRepo?: ActivityRepository): CacheService {
  if (!_cacheInstance) {
    _cacheInstance = new CacheService(activityRepo ?? new ActivityRepository());
    (globalThis as Record<string, unknown>)[CACHE_INSTANCE_STATE_KEY] = _cacheInstance;
  }
  return _cacheInstance;
}
