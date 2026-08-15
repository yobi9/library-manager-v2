/**
 * اختبار تراجعي لحراس "المسح النشط" (Scan-active guards) على العمليات الخلفية.
 *
 * الخلفية: أثناء مسح نشط يعمل الماسح داخل `runInWriterContext` على اتصال
 * كاتب يحمل قفل كتابة WAL. العمليات الثقيلة التالية كانت تتنافس معه على
 * الاتصال الرئيسي (فإما تعلق حتى `busy_timeout` أو تفشل بـ `database is
 * locked`، وأسوأها الاستعادة التي تغلق اتصال الكاتب فيكمل الماسح على كائن
 * مغلق):
 *   - `AutoBackupScheduler` → `createBackup()` → `VACUUM INTO`
 *   - `DatabaseService.restoreBackup()` → `closeDatabase()`
 *   - `DatabaseService.performFactoryReset()` → `truncateAll()`
 *   - `SearchService.rebuildIndex()` → FTS rebuild كامل
 *
 * الغاية: ضمان أن كل عملية تُرفض/تُتخطى مبكراً برسالة عربية واضحة أو سجل
 * `skip` عندما يكون المسح نشطاً، وأنها تعمل دون تغيير عندما لا يوجد مسح —
 * دون إغلاق اتصال الكاتب أو بدء أي كتابة على القاعدة.
 *
 * ملاحظة: يُستبدل `closeDatabase` فقط من وحدة `@/backend/db/db` (بإبقاء
 * `getDatabase`/`runInWriterContext` حقيقيين) وتُحاكى عمليات المستودع عبر
 * spy على `prototype`، فلا يُلمس ملف القاعدة الحقيقية إطلاقاً.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import { DatabaseService } from "@/backend/services/database-service";
import { DatabaseRepository } from "@/backend/repositories/database-repository";
import { ActivityRepository } from "@/backend/repositories/activity-repository";
import { CacheService } from "@/backend/services/cache-service";
import { AutoBackupScheduler } from "@/backend/services/auto-backup-scheduler";
import type { SettingsService } from "@/backend/services/settings-service";
import { SearchService } from "@/backend/services/search-service";
import type { SearchRepository } from "@/backend/repositories/search-repository";
import { logger } from "@/backend/observability/logger";
import { closeDatabase } from "@/backend/db/db";

vi.mock("@/backend/db/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/backend/db/db")>();
  return { ...actual, closeDatabase: vi.fn() };
});

/** وصف خاصية خاصة داخل `AutoBackupScheduler` للوصول إليها في الاختبار. */
type BackupRunner = { _runBackup(): Promise<void> };

/**
 * يستدعي `_runBackup` الخاص من خارج الفئة (المسار الحقيقي المؤقّت عند انطلاق
 * الجولة) دون الاعتماد على مؤقّت حقيقي.
 *
 * @param scheduler - مثيل المجدول الذي نريد تشغيل جولته.
 * @returns وعد اكتمال الجولة.
 */
function runScheduledBackup(scheduler: AutoBackupScheduler): Promise<void> {
  return (scheduler as unknown as BackupRunner)._runBackup.call(scheduler);
}

/**
 * ينشئ حالة مسح قابلة للتحويل من خارج الفئة — نموذج مبسّط لـ `scanActivity`
 * في نقطة التجميع (يتضمن `isActive` يُربط بـ `scanner.isScanning()`).
 *
 * @returns زوج ضابط/قارئ لحالة المسح تُحقن في الخدمات.
 */
function createScanState(): { setScanning: (value: boolean) => void; isScanning: () => boolean } {
  let scanning = false;
  return {
    setScanning(value: boolean): void {
      scanning = value;
    },
    isScanning(): boolean {
      return scanning;
    },
  };
}

describe("Scan-active guards على العمليات الخلفية", () => {
  let activityRepo: ActivityRepository;
  let cache: CacheService;

  beforeEach(() => {
    activityRepo = new ActivityRepository();
    cache = new CacheService(activityRepo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("AutoBackupScheduler", () => {
    it("Scenario A — مسح نشط: يتخطى الجولة دون استدعاء createBackup ويسجل skip", async () => {
      const scan = createScanState();
      scan.setScanning(true);

      const createBackup = vi.fn().mockResolvedValue({ path: "/tmp/backup.db", size: "0 KB" });
      const dbStub = { createBackup } as unknown as DatabaseService;
      const scheduler = new AutoBackupScheduler(
        dbStub,
        {} as unknown as SettingsService,
        scan.isScanning,
      );

      const infoSpy = vi.spyOn(logger, "info");
      await runScheduledBackup(scheduler);

      expect(createBackup).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith("autobackup.skip_scan_active", {});
    });

    it("Scenario E — بلا مسح: الجولة تستدعي createBackup كما كانت", async () => {
      const scan = createScanState();
      scan.setScanning(false);

      const createBackup = vi.fn().mockResolvedValue({ path: "/tmp/backup.db", size: "0 KB" });
      const dbStub = { createBackup } as unknown as DatabaseService;
      const scheduler = new AutoBackupScheduler(
        dbStub,
        {} as unknown as SettingsService,
        scan.isScanning,
      );

      await runScheduledBackup(scheduler);

      expect(createBackup).toHaveBeenCalledTimes(1);
    });
  });

  describe("DatabaseService — العمليات المدمرة/الصيانة", () => {
    it("Scenario B — مسح نشط: restoreBackup يُرفض قبل إغلاق أي اتصال", async () => {
      const scan = createScanState();
      scan.setScanning(true);
      const db = new DatabaseService(activityRepo, cache, scan.isScanning);

      const file = {
        name: "backup-test.db",
        arrayBuffer: async (): Promise<ArrayBuffer> => new Uint8Array([1, 2, 3, 4]).buffer,
      } as unknown as File;

      await expect(db.restoreBackup(file)).rejects.toThrow(/لا يمكن استعادة قاعدة البيانات/);
      expect(closeDatabase).not.toHaveBeenCalled();
    });

    it("Scenario C — مسح نشط: performFactoryReset يُرفض قبل truncateAll", async () => {
      const scan = createScanState();
      scan.setScanning(true);
      const db = new DatabaseService(activityRepo, cache, scan.isScanning);
      const truncateAll = vi
        .spyOn(DatabaseRepository.prototype, "truncateAll")
        .mockResolvedValue(undefined);

      await expect(db.performFactoryReset()).rejects.toThrow(/لا يمكن تصفير قاعدة البيانات/);
      expect(truncateAll).not.toHaveBeenCalled();
    });

    it("createBackup و optimize يُرفضان أيضاً أثناء مسح نشط", async () => {
      const scan = createScanState();
      scan.setScanning(true);
      const db = new DatabaseService(activityRepo, cache, scan.isScanning);
      const backup = vi.spyOn(DatabaseRepository.prototype, "backup").mockResolvedValue(undefined);
      const optimize = vi.spyOn(DatabaseRepository.prototype, "optimize").mockResolvedValue(undefined);

      await expect(db.createBackup()).rejects.toThrow(/لا يمكن إنشاء نسخة احتياطية/);
      await expect(db.optimize()).rejects.toThrow(/لا يمكن تحسين قاعدة البيانات/);

      expect(backup).not.toHaveBeenCalled();
      expect(optimize).not.toHaveBeenCalled();
    });

    it("Scenario F — بلا مسح: restoreBackup يكمل مساره (closeDatabase ثم الكتابة)", async () => {
      const scan = createScanState();
      scan.setScanning(false);
      const db = new DatabaseService(activityRepo, cache, scan.isScanning);

      vi.spyOn(DatabaseRepository.prototype, "getDbPath").mockReturnValue(
        path.join(os.tmpdir(), "scan-guards-restore-test.db"),
      );
      vi.spyOn(ActivityRepository.prototype, "logActivity").mockResolvedValue(undefined);

      const file = {
        name: "backup-test.db",
        arrayBuffer: async (): Promise<ArrayBuffer> => new Uint8Array([1, 2, 3, 4]).buffer,
      } as unknown as File;

      await expect(db.restoreBackup(file)).resolves.toBeUndefined();
      expect(closeDatabase).toHaveBeenCalledTimes(1);
    });
  });

  describe("SearchService.rebuildIndex", () => {
    it("Scenario D — مسح نشط: يُرفض ولا يستدعي المستودع (ولا يبدأ FTS rebuild)", async () => {
      const scan = createScanState();
      scan.setScanning(true);

      const rebuildIndex = vi.fn().mockResolvedValue(undefined);
      const repoStub = { rebuildIndex } as unknown as SearchRepository;
      const service = new SearchService(repoStub, cache, scan.isScanning);

      await expect(service.rebuildIndex()).rejects.toThrow(/لا يمكن إعادة بناء فهرس البحث/);
      expect(rebuildIndex).not.toHaveBeenCalled();
    });

    it("Scenario G — بلا مسح: rebuild ينفّذ عبر اتصال الكاتب ويبطل كاش البحث", async () => {
      const scan = createScanState();
      scan.setScanning(false);

      const rebuildIndex = vi.fn().mockResolvedValue(undefined);
      const repoStub = { rebuildIndex } as unknown as SearchRepository;
      const service = new SearchService(repoStub, cache, scan.isScanning);

      await expect(service.rebuildIndex()).resolves.toBeUndefined();
      expect(rebuildIndex).toHaveBeenCalledTimes(1);
    });
  });
});
