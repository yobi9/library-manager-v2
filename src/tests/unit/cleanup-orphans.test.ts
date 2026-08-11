/**
 * اختبار وحدة لـ `ScanOrchestrator.cleanupOrphanedItems` بعد تحسينات الأداء
 * (المرحلة 2 — نطاق الماسح فقط):
 *  1) Keyset pagination على `media_id` بدل `OFFSET`.
 *  2) فحص `fs.access` مرة واحدة لكل `directory_path` (المجلد الأب) بدل كل عنصر.
 *
 * الغاية: حماية "عقد العمل" — أن العناصر (وأحفادها) التي اختفى مجلدها من القرص
 * تُحذف، وأن العناصر التي ما زال مجلدها موجوداً تبقى، وأن `media_files` المرتبطة
 * تُحذف معها، مهما تغيّرت آلية الترحيل/الفحص مستقبلاً.
 *
 * ملاحظات التنفيذ:
 * - نزرع صفوف `media_items`/`media_files` مباشرة في قاعدة `:memory:` ثم نمرّر
 *   `runScan` بمشي اصطناعي فارغ (لا يستدعي `onItem`) حتى يصل التدفق الطبيعي
 *   إلى `cleanupOrphanedItems` في نهاية المسح (بعد `completeScan`).
 * - `libraryRepo.getById` يردّ مساراً حقيقياً (tempDir) لأن `checkPathAccessibility`
 *   يستخدم `fs.access` فعلياً.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ScanOrchestrator } from "@/backend/scanner/scan-orchestrator";
import { getDatabase } from "@/backend/db/db";
import type { DirectoryWalker } from "@/backend/scanner/directory-walker";
import type { DeletionDetector } from "@/backend/scanner/deletion-detector";
import type { LibraryRecord, WalkResult } from "@/backend/scanner/scanner-events";
import type { MediaRepository } from "@/backend/repositories/media-repository";
import type { LibraryRepository } from "@/backend/repositories/library-repository";
import type { SnapshotRepository } from "@/backend/repositories/snapshot-repository";

const EMPTY_WALK: WalkResult = {
  foldersScanned: 0,
  filesScanned: 0,
  foldersSkipped: 0,
  filesSkipped: 0,
  foldersExcluded: 0,
  excludedPaths: [],
};

/** مشي اصطناعي صامت: لا يستدعي `onItem` إطلاقاً (لا يُنشئ عناصر أثناء المسح). */
class EmptyWalker {
  private _aborted = false;
  abort() {
    this._aborted = true;
  }
  reset() {
    this._aborted = false;
  }
  async walk(): Promise<WalkResult> {
    return { ...EMPTY_WALK };
  }
}

/**
 * يبني `ScanOrchestrator` بمستودعات وهمية ومسار مكتبة حقيقي (tempDir) ويعيده
 * مع مآخذ `snapshotRepo` للتحقق.
 */
function makeHarness(tempDir: string): { scanner: ScanOrchestrator } {
  const mediaRepo = {} as unknown as MediaRepository;

  const libraryRepo = {
    getById: vi.fn(async (id: number): Promise<LibraryRecord> => ({
      library_id: id,
      name: `Lib-${id}`,
      type: "series",
      paths: [tempDir],
    })),
    getByParent: vi.fn(async (): Promise<LibraryRecord[]> => []),
  } as unknown as LibraryRepository;

  const snapshotRepo = {
    startScan: vi.fn().mockResolvedValue(undefined),
    completeScan: vi.fn().mockResolvedValue(undefined),
    interruptScan: vi.fn().mockResolvedValue(undefined),
    clearStaleSnapshots: vi.fn().mockResolvedValue(0),
  } as unknown as SnapshotRepository;

  const scanner = new ScanOrchestrator(mediaRepo, libraryRepo, snapshotRepo, {
    maxDepth: 8,
    batchDelayMs: 0,
    enableFileScan: true,
   batchSize: 50,             // ← was 200
    strictHierarchy: false,
  });

  scanner.directoryWalker = new EmptyWalker() as unknown as DirectoryWalker;
  scanner.deletionDetector = {
    detectDeleted: async () => ({ markedUnavailable: 0 }),
  } as unknown as DeletionDetector;

  return { scanner };
}

describe("ScanOrchestrator — cleanupOrphanedItems (المرحلة 2: keyset + فحص المجلد الأب)", () => {
  let tempDir = "";
  let keepDir = "";
  let missingDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "scan-cleanup-"));
    keepDir = path.join(tempDir, "keep-folder");
    missingDir = path.join(tempDir, "missing-folder");
    await fs.mkdir(keepDir, { recursive: true });

    const db = await getDatabase();
    // قاعدة `:memory:` مشتركة داخل الملف — نمسح صفوف الجلسة السابقة أولاً.
    await db.run("DELETE FROM media_files");
    await db.run("DELETE FROM media_items");
    await db.run("DELETE FROM libraries");
    await db.run(
      `INSERT INTO libraries (library_id, name, type, paths) VALUES (1, 'Lib', 'series', ?)`,
      [JSON.stringify([tempDir])],
    );
    // عنصر أب + طفل يقعان في مجلد مفقود (orphans) وعنصر مستقل في مجلد موجود.
    await db.run(
      `INSERT INTO media_items (media_id, library_id, parent_media_id, title, type, directory_path, is_available, is_leaf) VALUES
        (100, 1, NULL, 'Orphan Parent', 'season', ?, 1, 0),
        (101, 1, 100, 'Orphan Child', 'episode', ?, 1, 1),
        (200, 1, NULL, 'Keep Item', 'season', ?, 1, 0)`,
      [missingDir, missingDir, keepDir],
    );
    await db.run(
      `INSERT INTO media_files (file_id, media_id, library_id, file_path, is_available) VALUES
        (1, 101, 1, ?, 1)`,
      [path.join(missingDir, "orphan.mp4")],
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("يحذف العناصر (وأحفادها) التي اختفى مجلدها ويبقي الموجودة", async () => {
    const { scanner } = makeHarness(tempDir);

    const prepared = await scanner.prepareScan(1);
    expect(prepared.status).toBe("scanning");

    const finalState = await scanner.runScan(1);
    expect(finalState.status).toBe("completed");

    const db = await getDatabase();
    const orphanParent = (await db.get(
      "SELECT COUNT(*) as count FROM media_items WHERE media_id = 100",
    )) as { count: number };
    const orphanChild = (await db.get(
      "SELECT COUNT(*) as count FROM media_items WHERE media_id = 101",
    )) as { count: number };
    const orphanFile = (await db.get(
      "SELECT COUNT(*) as count FROM media_files WHERE file_id = 1",
    )) as { count: number };
    const keepItem = (await db.get(
      "SELECT COUNT(*) as count FROM media_items WHERE media_id = 200",
    )) as { count: number };

    expect(orphanParent.count).toBe(0);
    expect(orphanChild.count).toBe(0);
    expect(orphanFile.count).toBe(0);
    expect(keepItem.count).toBe(1);
  });

  it("لا يحذف عناصر بلا مجلد أب (directory_path فارغ) عند غياب الملف", async () => {
    const db = await getDatabase();
    await db.run(
      `INSERT INTO media_items (media_id, library_id, title, type, directory_path, is_available, is_leaf) VALUES
        (300, 1, 'Rootless', 'movie', NULL, 1, 1)`,
    );

    const { scanner } = makeHarness(tempDir);
    await scanner.prepareScan(1);
    const finalState = await scanner.runScan(1);
    expect(finalState.status).toBe("completed");

    const row = (await db.get(
      "SELECT COUNT(*) as count FROM media_items WHERE media_id = 300",
    )) as { count: number };
    expect(row.count).toBe(1);
  });
});
