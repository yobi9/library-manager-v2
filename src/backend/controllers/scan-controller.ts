import { BaseController, type ControllerResult } from "./base-controller";
import type { ScanOrchestrator } from "../scanner/scan-orchestrator";
import type { LibraryService } from "../services/library-service";
import type { LibraryMonitor } from "../scanner/LibraryMonitor";
import type { LibraryRecord, LibraryType, ScanStatus } from "../scanner/scanner-events";
import { ScanAlreadyRunningError } from "../scanner/scan-errors";
import { logger } from "../observability/logger";

/**
 * صف حالة مسح مكتبة واحدة كما تعرضه صفحة «العمليات الخلفية» الإدارية.
 *
 * `scanned_items` = مجموع العناصر المعالجة (`mediaAdded + mediaUpdated + mediaSkipped`)
 * من إحصاءات الفحص الجاري؛ و`total_items` تُملأ فقط عند انتهاء الفحص
 * (completed/stopped/failed) لأن الماسح لا يعرف العدد الكلي مسبقاً أثناء المسح؛
 * و`progress` = 100 عند الانتهاء و0 أثناء العمل أو الخمول.
 */
export interface ScanProcessRow {
  /** معرّف المكتبة في جدول `libraries`. */
  library_id: number;
  /** اسم المكتبة كما يظهر في واجهة الأدمن. */
  library_name: string;
  /** حالة الفحص الحالية لهذه المكتبة (`ScanStatus`). */
  status: ScanStatus;
  /** نسبة الإنجاز (0..100) — لا تُملأ أثناء المسح لأن الماسح بلا مقام كلي. */
  progress: number;
  /** عدد العناصر التي عالجها الفحص حتى اللحظة. */
  scanned_items: number;
  /** العدد الكلي المعروف عند الانتهاء، أو 0 أثناء المسح (غير معروف بعد). */
  total_items: number;
}

export class ScanController extends BaseController {
  constructor(
    private scanner: ScanOrchestrator,
    private libraryService: LibraryService,
    private libraryMonitor: LibraryMonitor,
  ) {
    super();
  }

  /**
   * Starts a scan for a single library. The prepare phase (slot guard,
   * library load, snapshot start) is awaited so real failures — most
   * importantly "a scan is already running" — are returned as proper
   * errors (409) instead of a false 202. The walk itself runs in the
   * background and reports progress over SSE.
   */
  async startScan(
    id: string,
    options?: { deepScan?: boolean; forceRescan?: boolean },
  ): Promise<ControllerResult> {
    try {
      const libraryId = this.parseId(id);
      const library = await this.libraryService.getLibraryById(libraryId);
      if (!library) return this.notFound("Library not found");

      const isContainer =
        ((library as Record<string, unknown>)["isContainer"] as boolean) ??
        ((library as Record<string, unknown>)["is_container"] as boolean) ??
        false;
      const type = (library as Record<string, unknown>)["type"] as LibraryType;

      if (isContainer || type === "main") {
        await this.scanner.prepareContainer(
          {
            library_id: libraryId,
            name: (library as Record<string, unknown>)["name"] as string,
            type,
            paths: "",
          },
          { deepScan: options?.deepScan, forceRescan: options?.forceRescan },
        );
        void this.scanner
          .runContainer(libraryId)
          .catch((err: Error) =>
            logger.error("scan.container_failed", { libraryId, message: err.message }),
          );
      } else {
        await this.scanner.prepareScan(libraryId, {
          deepScan: options?.deepScan,
          forceRescan: options?.forceRescan,
        });
        void this.scanner
          .runScan(libraryId)
          .catch((err: Error) =>
            logger.error("scan.run_failed", { libraryId, message: err.message }),
          );
      }

      return this.accepted(null, "Scan started in background");
    } catch (err) {
      if (err instanceof ScanAlreadyRunningError) return this.error(err.message, 409);
      return this.handleError(err);
    }
  }

  /**
   * Starts a scan of every active library. The batch slot is reserved
   * synchronously (409 on conflict) and the actual run happens in the
   * background, so the HTTP request is not held open for the whole batch.
   * Progress is reported over SSE.
   */
  async scanAll(options?: {
    deepScan?: boolean;
    forceRescan?: boolean;
  }): Promise<ControllerResult> {
    try {
      const libraries = await this.libraryService.getAllActive();
      if (libraries.length === 0) return this.ok([], "No active libraries to scan");

      this.scanner.prepareScanAll();

      void this.scanner
        .runScanAll(libraries as unknown as LibraryRecord[], options)
        .then((results) => {
          const ok = results.filter((r) => r.success).length;
          logger.info("scan.scan_all_finished", { ok, total: results.length });
        })
        .catch((err: Error) => logger.error("scan.scan_all_failed", { message: err.message }));

      return this.accepted(
        { total: libraries.length },
        `Scan initiated for ${libraries.length} libraries`,
      );
    } catch (err) {
      if (err instanceof ScanAlreadyRunningError) return this.error(err.message, 409);
      return this.handleError(err);
    }
  }

  async getProgress(id: string) {
    try {
      const libraryId = this.parseId(id);
      const progress = this.scanner.getProgress(libraryId);
      return this.ok(progress);
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * يجمع حالات المسح لكل المكتبات النشطة بصيغة صفحة «العمليات الخلفية».
   *
   * المكتبة النشطة التي لا يوجد لها `ScanState` جارٍ (لم تُمسح بعد، أو مسحها
   * القديم انتهى) تُرجع بالحالة `idle` حتى تظهر أزرار التحكم الخاصة بها.
   *
   * @returns كائن `{ rows, total }` حيث `rows` مصفوفة `ScanProcessRow` لكل مكتبة نشطة.
   */
  async getProcesses() {
    try {
      const libraries = await this.libraryService.getAllActive();
      const rows: ScanProcessRow[] = libraries
        .filter((lib): lib is NonNullable<typeof lib> => lib !== null)
        .map((lib) => {
        const libraryId = Number(lib["library_id"]);
        const libraryName = String(lib["name"]);
        const state = this.scanner.getState(libraryId);
        if (!state) {
          return {
            library_id: libraryId,
            library_name: libraryName,
            status: "idle" as const,
            progress: 0,
            scanned_items: 0,
            total_items: 0,
          };
        }
        const scanned =
          state.stats.mediaAdded + state.stats.mediaUpdated + state.stats.mediaSkipped;
        const finished =
          state.status === "completed" || state.status === "stopped" || state.status === "failed";
        return {
          library_id: state.libraryId,
          library_name: state.libraryName,
          status: state.status,
          progress: finished ? 100 : 0,
          scanned_items: scanned,
          total_items: finished ? scanned : 0,
        };
      });
      return this.ok({ rows, total: rows.length });
    } catch (err) {
      return this.handleError(err);
    }
  }

  async pauseScan(id: string) {
    try {
      const libraryId = this.parseId(id);
      const result = this.scanner.pauseScan(libraryId);
      if (!result) return this.error("No active scan to pause");
      return this.ok(null, "Scan paused");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async resumeScan(id: string) {
    try {
      const libraryId = this.parseId(id);
      const result = this.scanner.resumeScan(libraryId);
      if (!result) return this.error("No paused scan to resume");
      return this.ok(null, "Scan resumed");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async stopScan(id: string) {
    try {
      const libraryId = this.parseId(id);
      this.scanner.stopScan(libraryId);
      return this.ok(null, "Scan stopped");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async validateHierarchy() {
    try {
      const result = await this.scanner.validateAll();
      return this.ok(result);
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * يُفعّل أو يُعطّل مراقب الملفات (`LibraryMonitor`) لمكتبة معينة ويزامن
   * علامة `is_watched` في جدول المكتبات مع حالة المراقب.
   *
   * @param id - معرّف المكتبة المراد تغيير حالة مراقبتها.
   * @param active - `true` لبدء المراقبة، `false` لإيقافها.
   * @returns رسالة تأكيد النجاح (Watcher enabled/disabled).
   */
  async setWatcher(id: string, active: boolean) {
    try {
      const libraryId = this.parseId(id);
      if (active) {
        await this.libraryMonitor.watchLibrary(libraryId);
        await this.libraryService.updateLibrary(libraryId, { is_watched: true } as Record<string, unknown>);
      } else {
        await this.libraryMonitor.unwatchLibrary(libraryId);
        await this.libraryService.updateLibrary(libraryId, { is_watched: false } as Record<string, unknown>);
      }
      return this.ok(undefined, active ? "Watcher enabled" : "Watcher disabled");
    } catch (err) {
      return this.handleError(err);
    }
  }

  private accepted(data: unknown, message?: string) {
    return { success: true, status: 202, data, message } as const;
  }
}
