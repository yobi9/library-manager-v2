/**
 * اختبار وحدة لفصل "العناصر المكتوبة" عن "العناصر المزارة" في `MediaSyncService`
 * بعد تحسينات الأداء (فصل FTS Backfill + ختم `last_scan_id` الشرطي):
 *  1) `completeScan` يختم `last_scan_id` للعناصر التي تغيّرت فعلاً فقط
 *     (`getWrittenIds`)، فيبقى العنصر غير المتغيّر على ختمه السابق دون أي كتابة.
 *  2) العناصر الجديدة (التي لم تكن `last_scan_id` لها) تُختم بمعرّف المسح الحالي.
 *  3) المسح المتكرر بلا تغيّرات لا يعيد ختم أي `last_scan_id`.
 *
 * الغاية: حماية "عقد العمل" — أن الفحص السريع المتكرر بلا تغيّرات لا يلمس
 * `media_items` (توفير كتابات WAL التي كان `completeScan` يكتبها لكل العناصر)،
 * بينما يبقى ختم العناصر الجديدة سليماً (كانت `last_scan_id` تبقى NULL بدونه).
 *
 * ملاحظات التنفيذ:
 * - نستخدم مستودع `MediaRepository` حقيقياً (لأن `syncFileCore` يستدعي
 *   `getFileByPath`) على قاعدة `:memory:` المشتركة، ونستبدل `directoryWalker`
 *   بمشي اصطناعي يُصدر عناصر ملفات عبر `onItem`، و`deletionDetector` بوهمي
 *   لتجنّب أثر إعلان الحذف الجانبي.
 * - `libraryRepo`/`snapshotRepo` وهميان كالمعتاد (مسار المكتبة حقيقي tempDir
 *   لأن `checkPathAccessibility` يستخدم `fs.access` فعلياً).
 * - مسارات `media_files` المزروعة تُطبَّع عبر `normalizeStoragePath` لتطابق
 *   ما يقرأه `getFileByPath`.
 * - نزرع مجلداً أب (media_id=90) لأن `parent_media_id` يفرض FOREIGN KEY على
 *   `media_items(media_id)`، والمشّي الاصطناعي لا يصدر مجلدات (على غرار مسح
 *   ثانٍ تكون مجلداته قائمة مسبقاً)؛ وبدونه كان `parent_media_id=0` يفشل القيد.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ScanOrchestrator } from "@/backend/scanner/scan-orchestrator";
import { MediaRepository } from "@/backend/repositories/media-repository";
import { normalizeStoragePath } from "@/backend/repositories/base-repository";
import { getDatabase } from "@/backend/db/db";
import type { DirectoryWalker } from "@/backend/scanner/directory-walker";
import type { DeletionDetector } from "@/backend/scanner/deletion-detector";
import type { LibraryRecord, WalkResult, WalkedItem } from "@/backend/scanner/scanner-events";
import type { LibraryRepository } from "@/backend/repositories/library-repository";
import type { SnapshotRepository } from "@/backend/repositories/snapshot-repository";

/** مشي اصطناعي: يُصدر عناصر ملفات عبر `onItem` بدلاً من فحص نظام الملفات. */
class FileWalker {
  private readonly items: WalkedItem[];

  constructor(items: WalkedItem[]) {
    this.items = items;
  }

  abort() {}
  reset() {}

  async walk(
    _library: LibraryRecord,
    onItem: (item: WalkedItem) => Promise<number | null | undefined>,
  ): Promise<WalkResult> {
    for (const item of this.items) {
      await onItem(item);
    }
    return {
      foldersScanned: 0,
      filesScanned: this.items.length,
      foldersSkipped: 0,
      filesSkipped: 0,
      foldersExcluded: 0,
      excludedPaths: [],
    };
  }
}

/**
 * يبني `ScanOrchestrator` بمستودع `MediaRepository` حقيقي (على `:memory:`
 * المشتركة) وبمشي اصطناعي يصدر `items`، ويعيده مع كاشف مسار المكتبة.
 */
function makeHarness(tempDir: string, items: WalkedItem[]) {
  const mediaRepo = new MediaRepository();

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

  scanner.directoryWalker = new FileWalker(items) as unknown as DirectoryWalker;
  scanner.deletionDetector = {
    detectDeleted: async () => ({ markedUnavailable: 0 }),
  } as unknown as DeletionDetector;

  return { scanner, mediaRepo };
}

describe("ScanOrchestrator — ختم last_scan_id الشرطي (writtenMediaIds)", () => {
  let tempDir = "";
  let ep1Path = "";
  let ep2Path = "";
  let ep1Item: WalkedItem;
  let ep2Item: WalkedItem;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "scan-written-"));
    ep1Path = path.join(tempDir, "ep1.mp4");
    ep2Path = path.join(tempDir, "ep2.mp4");
    await fs.writeFile(ep1Path, "ep1-content");
    await fs.writeFile(ep2Path, "ep2-content");

    ep1Item = {
      name: "ep1.mp4",
      path: ep1Path,
      parentPath: tempDir,
      depth: 1,
      isFile: true,
      itemType: "episode",
      isRootFolder: false,
      parentMediaId: 90,
    };
    ep2Item = {
      name: "ep2.mp4",
      path: ep2Path,
      parentPath: tempDir,
      depth: 1,
      isFile: true,
      itemType: "episode",
      isRootFolder: false,
      parentMediaId: 90,
    };

    const db = await getDatabase();
    await db.run("DELETE FROM media_files");
    await db.run("DELETE FROM media_items");
    await db.run("DELETE FROM libraries");
    await db.run(
      `INSERT INTO libraries (library_id, name, type, paths) VALUES (1, 'Lib', 'series', ?)`,
      [JSON.stringify([tempDir])],
    );
    // مجلد أب قائم: يلزمه `media_items` صالح لأن `parent_media_id` قيد FOREIGN KEY.
    await db.run(
      `INSERT INTO media_items (media_id, library_id, parent_media_id, title, type, directory_path, is_available, is_leaf, last_scan_id) VALUES
        (90, 1, NULL, 'Folder', 'folder', ?, 1, 0, 'old-scan')`,
      [tempDir],
    );
    // عنصر قائم متاح من مسح سابق: يجب ألا يُعاد ختمه في مسح لاحق بلا تغيّرات.
    await db.run(
      `INSERT INTO media_items (media_id, library_id, parent_media_id, title, type, directory_path, is_available, is_leaf, last_scan_id) VALUES
        (100, 1, 90, 'Ep 1', 'episode', ?, 1, 1, 'old-scan')`,
      [tempDir],
    );
    await db.run(
      `INSERT INTO media_files (file_id, media_id, library_id, file_path, is_available) VALUES
        (1, 100, 1, ?, 1)`,
      [normalizeStoragePath(ep1Path)],
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("لا يعيد ختم العنصر غير المتغيّر، ويختم العنصر الجديد بمعرّف المسح الحالي", async () => {
    const { scanner } = makeHarness(tempDir, [ep1Item, ep2Item]);

    const prepared = await scanner.prepareScan(1);
    expect(prepared.status).toBe("scanning");

    const finalState = await scanner.runScan(1);
    expect(finalState.status).toBe("completed");

    const db = await getDatabase();
    const ep1 = (await db.get(
      "SELECT last_scan_id, is_available FROM media_items WHERE media_id = 100",
    )) as { last_scan_id: string | null; is_available: number };
    const ep2 = (await db.get(
      `SELECT m.last_scan_id, m.is_available FROM media_files f
       JOIN media_items m ON m.media_id = f.media_id
       WHERE f.file_path = ?`,
      [normalizeStoragePath(ep2Path)],
    )) as { last_scan_id: string | null; is_available: number };

    // ep1 لم يتغيّر: بقي على ختم المسح السابق ولم يُعد كتابته.
    expect(ep1.last_scan_id).toBe("old-scan");
    expect(ep1.is_available).toBe(1);

    // ep2 جديد: أُنشئ (last_scan_id كانت NULL) ثم خُتم بمعرّف المسح الحالي.
    expect(ep2.last_scan_id).toBe(prepared.scanId);
    expect(ep2.is_available).toBe(1);
  });

  it("المسح المتكرر بلا تغيّرات لا يعيد ختم أي last_scan_id", async () => {
    const { scanner } = makeHarness(tempDir, [ep1Item, ep2Item]);

    const first = await scanner.prepareScan(1);
    await scanner.runScan(1);

    // مسح ثانٍ على نفس الملفات بلا أي تغيّر: لا كتابة → لا ختم جديد.
    const second = await scanner.prepareScan(1);
    expect(second.scanId).not.toBe(first.scanId);
    const finalState = await scanner.runScan(1);
    expect(finalState.status).toBe("completed");

    const db = await getDatabase();
    const ep2 = (await db.get(
      `SELECT m.last_scan_id FROM media_files f
       JOIN media_items m ON m.media_id = f.media_id
       WHERE f.file_path = ?`,
      [normalizeStoragePath(ep2Path)],
    )) as { last_scan_id: string | null };
    const ep1 = (await db.get("SELECT last_scan_id FROM media_items WHERE media_id = 100")) as {
      last_scan_id: string | null;
    };

    // يبقي كلاهما على ختم المسح الأول (لا يعيد الثاني ختمهما).
    expect(ep2.last_scan_id).toBe(first.scanId);
    expect(ep1.last_scan_id).toBe("old-scan");
  });
});
