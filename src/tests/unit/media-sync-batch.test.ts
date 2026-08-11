/**
 * اختبارات وحدة لتجميع كتابة عناصر المسح (P3 — "معاملة لكل دفعة").
 *
 * الخلفية: قبل P3 كان كل عنصر يُزامن داخل معاملة مستقلة (SAVEPOINT + قفل
 * `withExclusiveTransaction`)، فأصبح عدد الالتزامات يساوي عدد العناصر. بعد P3
 * يعمل المشي كله داخل `runBatched` (تحفظة دفعة خارجية تُمسك بالقفل نفسه)، وكل
 * عنصر يُلتزم داخل SAVEPOINT متداخل، وكل `batchSize` عنصر تُغلق الدفعة وتلتزم
 * وتُفتح دفعة جديدة.
 *
 * الغاية — حماية "عقد العمل" الثلاثة:
 *  1) التزام جماعي: كتابة عناصر الدفعة غير مرئية من اتصال آخر حتى تُلتزم
 *     الدفعة كاملة (حدود `batchSize`).
 *  2) عزل الفشل: عنصر فاشل يتراجع وحده؛ إخوته الناجحون يبقون ملتزمين — لا
 *     تراجع دفعة كاملة يكسر مراجع الأب/الطفل (السبب الذي أُجّل من أجله هذا
 *     البند سابقاً).
 *  3) ذيل الدفعة: فشل المشي نفسه (خطأ قاتل في `fn`) يُسقط الدفعة المفتوحة
 *     الحالية دون التزام جزئي.
 *
 * ملاحظات التنفيذ:
 * - نستخدم قاعدة FILE حقيقية (WAL) يشاركها اتصالا القراءة والكتابة كما في
 *   الإنتاج؛ نقرأ من الاتصال الرئيسي لرصد الالتزامات الفعلية — غير الملتزم
 *   غير مرئي عبر اتصال آخر (سلوك shared cache للذاكرة يُعيد SQLITE_LOCKED
 *   بدل ذلك، فيحجب القراءة تماماً).
 * - `syncDirectory` بمسح سريع لا يحتاج ملفات على القرص (فشل imageLinker على
 *   ENOENT صامت)، بينما `syncFile` يحتاج ملفاً حقيقياً (`fs.stat`).
 * - لإجبار فشل "كتب ثم فشل" في `syncFile`: نزرع صف `media_files` بمسار مطابق
 *   لمسار ملفنا لكن لمكتبة أخرى (999) — `file_path` فريد عالمياً فيُتجاهَل
 *   `INSERT OR IGNORE` وينكشف "Failed to create or retrieve file record"
 *   بعد نجاح إنشاء عنصر الحلقة، فيُثبت التراجع أن كتابة الحلقة أُسقطت.
 */
import { describe, expect, it, beforeEach, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  initializeDatabase,
  initializeWriterDatabase,
  closeDatabase,
  runInWriterContext,
} from "@/backend/db/db";
import { MediaSyncService } from "@/backend/scanner/media-sync.service";
import { MediaRepository } from "@/backend/repositories/media-repository";
import { SnapshotRepository } from "@/backend/repositories/snapshot-repository";
import { HierarchyRules } from "@/backend/scanner/hierarchy-rules";
import { ImageLinkerService } from "@/backend/scanner/image-linker.service";
import { PathValidationService } from "@/backend/scanner/path-validation.service";
import type { LibraryRecord, WalkedItem } from "@/backend/scanner/scanner-events";

const LIBRARY: LibraryRecord = { library_id: 1, name: "Lib", type: "series", paths: [] };
// الـ scanId يُدمج في أسماء SAVEPOINT (رموز SQL) لذا يجب ألا يحتوي على واصلات —
// الإنتاج يولّده بشرطات سفلية في scan-state.ts: `scan_${Date.now()}_${random}`.
const SCAN_ID = "scan_batch_test";

let mainDb: Awaited<ReturnType<typeof initializeDatabase>>;
let mediaRepo: MediaRepository;
let syncService: MediaSyncService;
let tmpDir: string;

/** يبني عنصر مجلد (سريع — بلا حاجة لملفات على القرص). */
function dirItem(
  name: string,
  dirPath: string,
  parentPath: string,
  itemType: string,
  parentMediaId: number | null,
  isRoot = false,
): WalkedItem {
  return {
    name,
    path: dirPath,
    parentPath,
    depth: isRoot ? 0 : 1,
    isFile: false,
    itemType,
    isRootFolder: isRoot,
    parentMediaId,
  };
}

/** يبني عنصر ملف (يتطلب وجود الملف فعلياً على القرص — `fs.stat`). */
function fileItem(
  name: string,
  filePath: string,
  parentPath: string,
  parentMediaId: number,
): WalkedItem {
  return {
    name,
    path: filePath,
    parentPath,
    depth: 2,
    isFile: true,
    itemType: "episode",
    isRootFolder: false,
    parentMediaId,
  };
}

/** عدّاد من اتصال القراءة الرئيسي — يرى الالتزامات الفعلية فقط. */
async function countItems(libraryId: number, type?: string): Promise<number> {
  const row = type
    ? ((await mainDb.get(
        "SELECT COUNT(*) as count FROM media_items WHERE library_id = ? AND type = ?",
        [libraryId, type],
      )) as { count: number })
    : ((await mainDb.get("SELECT COUNT(*) as count FROM media_items WHERE library_id = ?", [
        libraryId,
      ])) as { count: number });
  return Number(row?.count ?? 0);
}

beforeAll(async () => {
  // نستخدم قاعدة FILE حقيقية (WAL) بدل `:memory:`: اتصالا القراءة والكتابة
  // يشتركان الملف نفسه كما في الإنتاج، فيرى القارئ لقطات ملتزمة فقط بينما
  // يحمل الكاتب تغييرات غير ملتزمة — هو المعيار الذي نتحقق منه (سلوك shared
  // cache للذاكرة يُعيد SQLITE_LOCKED بدل ذلك، فيحجب القراءة تماماً).
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lib-db-"));
  process.env["DATABASE_URL"] = path.join(tmpDir, "test.db");
  mainDb = await initializeDatabase();
  await initializeWriterDatabase();
  mediaRepo = new MediaRepository();
  syncService = new MediaSyncService(
    mediaRepo,
    new SnapshotRepository(),
    new HierarchyRules(),
    new ImageLinkerService(mediaRepo),
    new PathValidationService(),
    SCAN_ID,
  );
});

afterAll(async () => {
  await closeDatabase();
  delete process.env["DATABASE_URL"];
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

beforeEach(async () => {
  // تنظيف قاعدة الملف بين اختبارات هذا الملف (بترتيب يحترم FK).
  await mainDb.run("DELETE FROM media_files");
  await mainDb.run("DELETE FROM media_items");
  await mainDb.run("DELETE FROM libraries");
  await mainDb.run(
    "INSERT INTO libraries (library_id, name, type, paths) VALUES (1, 'Lib', 'series', '[]')",
  );
  await mainDb.run(
    "INSERT INTO libraries (library_id, name, type, paths) VALUES (999, 'OtherLib', 'series', '[]')",
  );
});

describe("MediaSyncService — تجميع كتابة العناصر (P3)", () => {
  it("يلتزم العناصر في دفعات (كل batchSize) ويحجز ذيل الدفعة حتى نهاية runBatched", async () => {
    const libDir = await fs.mkdtemp(path.join(os.tmpdir(), "lib-batch-"));
    try {
      const showDir = path.join(libDir, "Show");

      await runInWriterContext(() =>
        syncService.runBatched(async () => {
          const series = await syncService.syncDirectory(
            dirItem("Show", showDir, libDir, "series", null, true),
            LIBRARY,
            false,
          );
          expect(series.isNew).toBe(true);

          // Season 1 يُضاف للدفعة المفتوحة {Show, Season 1} — غير ملتزمة بعد.
          await syncService.syncDirectory(
            dirItem("Season 1", path.join(showDir, "Season 1"), showDir, "season", series.mediaId),
            LIBRARY,
            false,
          );
          expect(await countItems(1)).toBe(0);

          // Season 2 يفتح دفعة جديدة فتُلتزم الدفعة السابقة كاملة {Show, Season 1}.
          await syncService.syncDirectory(
            dirItem("Season 2", path.join(showDir, "Season 2"), showDir, "season", series.mediaId),
            LIBRARY,
            false,
          );
          expect(await countItems(1)).toBe(2);

          // Season 3 داخل الدفعة المفتوحة {Season 2} — لا التزام جديد بعد.
          await syncService.syncDirectory(
            dirItem("Season 3", path.join(showDir, "Season 3"), showDir, "season", series.mediaId),
            LIBRARY,
            false,
          );
          expect(await countItems(1)).toBe(2);

          // Season 4 يلتزم {Season 2, Season 3} كاملة — Season 4 في دفعة مفتوحة بعد.
          await syncService.syncDirectory(
            dirItem("Season 4", path.join(showDir, "Season 4"), showDir, "season", series.mediaId),
            LIBRARY,
            false,
          );
          expect(await countItems(1)).toBe(4);
        }, 2),
      );

      // ذيل الدفعة {Season 4} التزم مع إغلاق runBatched.
      expect(await countItems(1)).toBe(5);
    } finally {
      await fs.rm(libDir, { recursive: true, force: true });
    }
  });

  it("عنصر فاشل يتراجع وحده داخل الدفعة ولا يُسقط إخوته (عزل الفشل)", async () => {
    const libDir = await fs.mkdtemp(path.join(os.tmpdir(), "lib-isolation-"));
    try {
      const showDir = path.join(libDir, "Show");
      const seasonDir = path.join(showDir, "Season 1");
      await fs.mkdir(seasonDir, { recursive: true });
      const videoPath = path.join(seasonDir, "E01.mp4");
      await fs.writeFile(videoPath, "fake");

      // صف "متضارب": نفس مسار الملف لكن لمكتبة أخرى — file_path فريد عالمياً.
      const storagePath = mediaRepo.normalizePath(videoPath);
      await mainDb.run(
        "INSERT INTO media_items (media_id, library_id, title, type) VALUES (9000, 999, 'Owner', 'season')",
      );
      await mainDb.run(
        "INSERT INTO media_files (media_id, library_id, file_path, is_available) VALUES (9000, 999, ?, 1)",
        [storagePath],
      );

      await runInWriterContext(() =>
        syncService.runBatched(async () => {
          const series = await syncService.syncDirectory(
            dirItem("Show", showDir, libDir, "series", null, true),
            LIBRARY,
            false,
          );
          const season = await syncService.syncDirectory(
            dirItem("Season 1", seasonDir, showDir, "season", series.mediaId),
            LIBRARY,
            false,
          );
          expect(season.isNew).toBe(true);

          // عنصر حلقة فاشل: createMedia نجح (كتابة جزئية) ثم createFile فشل.
          await expect(
            syncService.syncFile(
              fileItem("E01.mp4", videoPath, seasonDir, season.mediaId),
              LIBRARY,
              season.mediaId,
              false,
            ),
          ).rejects.toThrow(/Failed to create or retrieve file record/);

          // أخ ينجح بعد الفاشل داخل نفس الدفعة.
          await syncService.syncDirectory(
            dirItem("Season 2", path.join(showDir, "Season 2"), showDir, "season", series.mediaId),
            LIBRARY,
            false,
          );
        }, 10),
      );

      // إخوة الفاشل بقوا ملتزمين...
      expect(await countItems(1, "season")).toBe(2);
      // ...بينما عنصر الحلقة الذي كُتب جزئياً ثم فشل اختفى تماماً.
      expect(await countItems(1, "episode")).toBe(0);
    } finally {
      await fs.rm(libDir, { recursive: true, force: true });
    }
  });

  it("فشل المشي نفسه (خطأ قاتل) يُسقط ذيل الدفعة المفتوح دون التزام جزئي", async () => {
    const libDir = await fs.mkdtemp(path.join(os.tmpdir(), "lib-fatal-"));
    try {
      const showDir = path.join(libDir, "Show");

      await runInWriterContext(() =>
        expect(
          syncService.runBatched(async () => {
            const series = await syncService.syncDirectory(
              dirItem("Show", showDir, libDir, "series", null, true),
              LIBRARY,
              false,
            );
            await syncService.syncDirectory(
              dirItem(
                "Season 1",
                path.join(showDir, "Season 1"),
                showDir,
                "season",
                series.mediaId,
              ),
              LIBRARY,
              false,
            );
            throw new Error("walk failed");
          }, 100),
        ).rejects.toThrow("walk failed"),
      );

      // الدفعة المفتوحة أُسقطت: لا عناصر من هذه الجولة على الإطلاق.
      expect(await countItems(1)).toBe(0);
    } finally {
      await fs.rm(libDir, { recursive: true, force: true });
    }
  });
});
