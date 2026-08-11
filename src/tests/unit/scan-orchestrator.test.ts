/**
 * اختبارات وحدة لدورة حياة `ScanOrchestrator` بعد إصلاحات المرحلة 1:
 *  1) حارس "مسح واحد نشط" (TOCTOU-safe) يرفض أي مسح جديد أثناء فتحة محجوزة.
 *  2) مسح طفل (`isChildScan`) يعمل تحت فتحة الأب دون نزعها.
 *  3) `stop` أثناء `pause` لا يعلّق المشي للأبد ويحدّث الـ snapshot كـ interrupted.
 *  4) `resume` بعد `pause` يكمّل المسح بنجاح إلى completed.
 *  5) لا تسميم للأعلام: بعد الإيقاف يُسمح بمسح جديد من البداية.
 *
 * الغاية: حماية "عقد العمل" في `scan-orchestrator.ts` — خاصة أن `stopScan`
 * يطلق مؤقّتي الانتظار (`_pauseWaiters`) قبل وضع الحالة stopped حتى لا يتجمّد
 * `waitForResume` للأبد، وأن `prepareScan` يصفّر أعلام `_aborted`/`_paused`
 * عند حجز الفتحة فلا يورّث المسحُ الموقوفُ حالةَ التوقف لمسحٍ لاحق.
 *
 * ملاحظات التنفيذ:
 * - نستبدل `directoryWalker` بمتحكم اصطناعي (`ControlledWalker`) لإجبار نقطة
 *   التوقف بدقة؛ والـ deletionDetector بوهمي لتجنّب اعتماديات قاعدة البيانات.
 * - `completeScan` في مسار الإكمال يلامس `getDatabase()` على `:memory:`
 *   (جداول فارغة) — آمن ومتوقّع في بيئة الاختبار.
 * - `libraryRepo.getById` يردّ مكتبة بمسار حقيقي (tempDir) لأن
 *   `checkPathAccessibility` يستخدم `fs.access` فعلياً.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ScanOrchestrator } from "@/backend/scanner/scan-orchestrator";
import { ScanAlreadyRunningError } from "@/backend/scanner/scan-errors";
import type { DirectoryWalker } from "@/backend/scanner/directory-walker";
import type { DeletionDetector } from "@/backend/scanner/deletion-detector";
import type { LibraryRecord, WalkResult, WalkedItem } from "@/backend/scanner/scanner-events";
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

/**
 * مشي اصطناعي متحكَّم فيه: يسمح بإمساك دخول `walk` عند بوابة حتى نحرّرها، ثم
 * يمرّ عبر `onPause` الفعلي للمنسّق (والذي يعيد `waitForResume` عندما يكون
 * المسح paused). هذا يتيح للاختبار محاكاة المشي المعلّق على pause بدقة.
 */
class ControlledWalker {
  private _aborted = false;
  private gateResolvers: Array<() => void> = [];
  holdGate = false;
  onPauseCalls = 0;
  /** Resolves once the walk has actually reached the gate and is blocked on it. */
  gateHeld: Promise<void>;
  private _resolveGateHeld!: () => void;

  constructor() {
    this.gateHeld = new Promise((resolve) => {
      this._resolveGateHeld = resolve;
    });
  }

  abort() {
    this._aborted = true;
  }
  reset() {
    this._aborted = false;
  }
  releaseGate() {
    const resolvers = this.gateResolvers;
    this.gateResolvers = [];
    for (const resolve of resolvers) resolve();
  }

  async walk(
    _library: LibraryRecord,
    _onItem: (item: WalkedItem) => Promise<number | null | undefined>,
    onPause?: () => Promise<void>,
  ): Promise<WalkResult> {
    if (this.holdGate) {
      await new Promise<void>((resolve) => {
        this.gateResolvers.push(resolve);
        this._resolveGateHeld();
      });
    }
    if (onPause) {
      this.onPauseCalls++;
      await onPause();
    }
    return { ...EMPTY_WALK };
  }
}

interface RepoMocks {
  startScan: ReturnType<typeof vi.fn>;
  completeScan: ReturnType<typeof vi.fn>;
  interruptScan: ReturnType<typeof vi.fn>;
  clearStaleSnapshots: ReturnType<typeof vi.fn>;
}

/**
 * يبني `ScanOrchestrator` بمستودعات وهمية ومسارات حقيقية (tempDir) ويعيد
 * المنسّق مع كاشفات الاستدعاء لِـ `snapshotRepo`.
 */
function makeHarness(
  tempDir: string,
  walker: ControlledWalker,
): { scanner: ScanOrchestrator; snapshotRepo: RepoMocks } {
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

  scanner.directoryWalker = walker as unknown as DirectoryWalker;
  scanner.deletionDetector = {
    detectDeleted: async () => ({ markedUnavailable: 0 }),
  } as unknown as DeletionDetector;

  return {
    scanner,
    snapshotRepo: snapshotRepo as unknown as RepoMocks,
  };
}

describe("ScanOrchestrator — حارس المسح الواحد (Phase 1)", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "scan-orch-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("يرفض مسحاً ثانياً (نفس المكتبة أو غيرها) ما دامت الفتحة محجوزة", async () => {
    const walker = new ControlledWalker();
    const { scanner } = makeHarness(tempDir, walker);

    const state = await scanner.prepareScan(1);
    expect(state.status).toBe("scanning");

    await expect(scanner.prepareScan(2)).rejects.toBeInstanceOf(ScanAlreadyRunningError);
    await expect(scanner.prepareScan(1)).rejects.toBeInstanceOf(ScanAlreadyRunningError);

    // تحرير الفتحة عبر stop ثم runScan (المسار الموقوف لا يلمس قاعدة البيانات).
    expect(scanner.stopScan(1)).toBe(true);
    const stopped = await scanner.runScan(1);
    expect(stopped.status).toBe("stopped");

    // بعد التحرير يُقبل مسح جديد.
    await expect(scanner.prepareScan(1)).resolves.toBeDefined();
  });

  it("مسح طفل (isChildScan) يعمل تحت فتحة الأب ولا يستهلكها", async () => {
    const walker = new ControlledWalker();
    const { scanner } = makeHarness(tempDir, walker);

    await scanner.prepareScan(1);
    const child = await scanner.prepareScan(2, { isChildScan: true });
    expect(child.status).toBe("scanning");

    // الفتحة ما زال يملكها الأب: أي مسح ثالث مرفوض رغم نجاح الطفل.
    await expect(scanner.prepareScan(3)).rejects.toBeInstanceOf(ScanAlreadyRunningError);

    expect(scanner.stopScan(1)).toBe(true);
    await scanner.runScan(1);
    await expect(scanner.prepareScan(2)).resolves.toBeDefined();
  });

  it("prepareScanAll يحجز الفتحة بشكل متزامن ويرفض أي مسح أثناء الحجز", async () => {
    const walker = new ControlledWalker();
    const { scanner } = makeHarness(tempDir, walker);

    scanner.prepareScanAll();
    expect(() => scanner.prepareScanAll()).toThrow(ScanAlreadyRunningError);
    await expect(scanner.prepareScan(1)).rejects.toBeInstanceOf(ScanAlreadyRunningError);

    await scanner.runScanAll([]);
    await expect(scanner.prepareScan(1)).resolves.toBeDefined();
  });

  it("stop أثناء pause لا يعلّق المشي للأبد ويحدّث snapshot كـ interrupted", async () => {
    const walker = new ControlledWalker();
    walker.holdGate = true;
    const { scanner, snapshotRepo } = makeHarness(tempDir, walker);

    const prepared = await scanner.prepareScan(1);

    const runPromise = scanner.runScan(1);
    // انتظار وصول المشي فعلياً إلى البوابة قبل pause/release حتى لا يسبق
    // releaseGate المشيَ (الذي يبدأ عبر microtasks بعد استدعاء runScan).
    await walker.gateHeld;
    expect(scanner.pauseScan(1)).toBe(true);
    expect(scanner.getState(1)?.status).toBe("paused");

    // نطلق البوابة ليصل المشي إلى onPause الفعلي (المعلّق على waitForResume).
    walker.releaseGate();
    await new Promise((resolve) => setImmediate(resolve));

    // بدون إصلاح المرحلة 1 كان هذا يعلّق runScan للأبد (لا يطلق pause waiters).
    expect(scanner.stopScan(1)).toBe(true);

    const finalState = await runPromise;
    expect(finalState.status).toBe("stopped");
    expect(snapshotRepo.interruptScan).toHaveBeenCalledWith(1, prepared.scanId);
    expect(snapshotRepo.completeScan).not.toHaveBeenCalled();

    // لا تسميم: بعد الإيقاف يُقبل مسح جديد وتُصفَّر الأعلام.
    const fresh = await scanner.prepareScan(1);
    expect(fresh.status).toBe("scanning");
  });

  it("resume بعد pause يكمّل المسح إلى completed دون interrupt", async () => {
    const walker = new ControlledWalker();
    walker.holdGate = true;
    const { scanner, snapshotRepo } = makeHarness(tempDir, walker);

    await scanner.prepareScan(1);

    const runPromise = scanner.runScan(1);
    // انتظار وصول المشي للبوابة (نفس ملاحظة اختبار stop) قبل pause.
    await walker.gateHeld;
    expect(scanner.pauseScan(1)).toBe(true);

    walker.releaseGate();
    await new Promise((resolve) => setImmediate(resolve));

    expect(scanner.resumeScan(1)).toBe(true);
    expect(scanner.getState(1)?.status).toBe("scanning");

    const finalState = await runPromise;
    expect(finalState.status).toBe("completed");
    expect(snapshotRepo.completeScan).toHaveBeenCalled();
    expect(snapshotRepo.interruptScan).not.toHaveBeenCalled();
  });

  it("getActiveProgress يعيد تقدم أحدث مسح نشط (scanning/paused) أو null", async () => {
    const walker = new ControlledWalker();
    const { scanner } = makeHarness(tempDir, walker);

    expect(scanner.getActiveProgress()).toBeNull();

    await scanner.prepareScan(1);
    const p1 = scanner.getActiveProgress();
    expect(p1).not.toBeNull();
    expect(p1?.libraryId).toBe(1);
    expect(p1?.status).toBe("scanning");

    // أحدث بدء (الطفل) يفوز على الأب رغم أن كليهما scanning.
    await scanner.prepareScan(2, { isChildScan: true });
    const p2 = scanner.getActiveProgress();
    expect(p2?.libraryId).toBe(2);
    expect(p2?.status).toBe("scanning");

    // paused ما زال "نشطاً" من وجهة إبقاء نافذة التقدم مفتوحة.
    expect(scanner.pauseScan(2)).toBe(true);
    expect(scanner.getActiveProgress()?.status).toBe("paused");

    expect(scanner.stopScan(1)).toBe(true);
    await scanner.runScan(1);
    expect(scanner.getActiveProgress()).toBeNull();
  });

  it("isScanning يعكس وجود مسح نشط أو paused", async () => {
    const walker = new ControlledWalker();
    const { scanner } = makeHarness(tempDir, walker);

    expect(scanner.isScanning()).toBe(false);
    await scanner.prepareScan(1);
    expect(scanner.isScanning()).toBe(true);
    expect(scanner.isScanning(1)).toBe(true);

    expect(scanner.pauseScan(1)).toBe(true);
    expect(scanner.isScanning()).toBe(false); // paused ليس نشطاً
    expect(scanner.isScanning(1)).toBe(false);

    expect(scanner.stopScan(1)).toBe(true);
    await scanner.runScan(1);
    expect(scanner.isScanning()).toBe(false);
  });
});
