import type { ActivityService } from "./activity-service";
import type { SecurityService } from "./security-service";
import type { VisitorService } from "./visitor-service";
import type { SettingsService } from "./settings-service";
import type { SnapshotRepository } from "../repositories/snapshot-repository";
import { logger } from "../observability/logger";
import { trackBackgroundJob } from "../observability/operations";

/** عدد أيام الاحتفاظ بأنشطة الزوار قبل الحذف التلقائي (7 أيام). */
const VISITOR_ACTIVITY_RETENTION_DAYS = 7;

/** عدد أيام الاحتفاظ بأنشطة المستخدمين/النظام قبل الحذف التلقائي (90 يوماً). */
const ACTIVITY_RETENTION_DAYS = 90;

/** عدد أيام الاحتفاظ بأحداث الأمان قبل الحذف التلقائي (180 يوماً). */
const SECURITY_EVENT_RETENTION_DAYS = 180;

/** عدد أيام الاحتفاظ بأحداث زيارات الزوار قبل الحذف التلقائي (7 أيام). */
const VISITOR_EVENT_RETENTION_DAYS = 7;

/** عدد أيام الاحتفاظ بسجل تدقيق الإعدادات قبل الحذف التلقائي (180 يوماً). */
const SETTINGS_AUDIT_RETENTION_DAYS = 180;

/** عدد أيام الاحتفاظ بسجلات المسح (library_snapshots) قبل الحذف التلقائي (90 يوماً). */
const SNAPSHOT_RETENTION_DAYS = 90;

/** تأخير أول تنظيف بعد إقلاع الخادم — نتجنب منافسة التهيئة/المسح عند البداية. */
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000;

/** الفاصل الزمني بين عمليات التنظيف المجدولة (كل 24 ساعة). */
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * منظّم الاحتفاظ بالسجلات — ينفّذ تنظيفاً دورياً تلقائياً لجدول الأنشطة، أحداث
 * الأمان، أحداث زيارات الزوار، سجل تدقيق الإعدادات وسجلات المسح (library_snapshots)
 * حتى لا تنمو القاعدة بلا حدود مع تراكم أحداث المشاهدات والزيارات وفشل الدخول.
 *
 * @remarks
 * - لا يعتمد على إعدادات من قاعدة البيانات (ثوابت فوق) عكس `AutoBackupScheduler`.
 * - مؤقتات `unref` فلا تُبقي الخادم حياً ولوحدها.
 * - أي فشل أثناء التنظيف يُسجَّل في الـ console فقط ولا يعطّل الدورة التالية.
 */
export class RetentionScheduler {
  private _timeout: ReturnType<typeof setTimeout> | null = null;
  private _interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private activityService: ActivityService,
    private securityService: SecurityService,
    private visitorService: VisitorService,
    private settingsService: SettingsService,
    private snapshotRepository: SnapshotRepository,
    /** اختياري: مسند يعيد `true` عندما يكون مسح نشط (يتخطى التنظيف حينها). */
    private isScanActive?: () => boolean,
  ) {}

  /**
   * يجدول أول تنظيف بعد 5 دقائق من الإقلاع ثم كل 24 ساعة.
   */
  start(): void {
    this.stop();
    this._timeout = setTimeout(() => {
      void this._runCleanup();
    }, FIRST_RUN_DELAY_MS);
    this._timeout.unref();
    this._interval = setInterval(() => {
      void this._runCleanup();
    }, RUN_INTERVAL_MS);
    this._interval.unref();
  }

  /**
   * يلغي أي تنظيف مجدول (يُستدعى عند إيقاف الخادم أو في الاختبارات).
   */
  stop(): void {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  /**
   * ينفّذ التنظيف الفعلي: أنشطة الزوار + الأنشطة العامة + أحداث الأمان +
   * سجلات المسح، كلٌّ بحدود الاحتفاظ الخاصة به. فشل إحدى المراحل لا يمنع باقي
   * المراحل لأن كل استدعاء داخل `try/catch` الخاص به.
   */
  private async _runCleanup(): Promise<void> {
    // رفض جولة التنظيف أثناء مسح نشط: عبارات DELETE على الاتصال الرئيسي تتنافس
    // مع كاتب الماسح على قفل الكتابة (WAL) وتنتهي بـ `SQLITE_BUSY` بعد
    // `busy_timeout`. التخطي يرحّل الجولة إلى الدورة التالية (كل 24 ساعة) بدل
    // إشغال نافذة كتابة الماسح — الحذف المؤجل لا يكسر أي عقد بيانات.
    if (this.isScanActive?.() === true) {
      logger.info("retention.cleanup_skipped", { reason: "scan_active" });
      return;
    }

    // يُسجَّل كوظيفة خلفية في شجرة العمليات حتى يظهر تداخله مع المسح (نوع
    // `retention_cleanup`) في تقرير الاختناقات عبر `trackBackgroundJob`.
    await trackBackgroundJob(
      "background_job",
      "retentionCleanup",
      async () => {
        await this._safe(() => this.activityService.deleteOldVisitorActivities());
        await this._safe(() => this.activityService.deleteOldActivities(ACTIVITY_RETENTION_DAYS));
        await this._safe(() => this.securityService.deleteOldEvents(SECURITY_EVENT_RETENTION_DAYS));
        await this._safe(() =>
          this.visitorService.deleteOldVisitorEvents(VISITOR_EVENT_RETENTION_DAYS),
        );
        await this._safe(() =>
          this.settingsService.deleteOldAuditLog(SETTINGS_AUDIT_RETENTION_DAYS),
        );
        await this._safe(() => this.snapshotRepository.deleteOldSnapshots(SNAPSHOT_RETENTION_DAYS));
      },
      { component: "RetentionScheduler" },
    );
  }

  /**
   * يغلّف عملية تنظيف بـ try/catch ويُسجّل الفشل دون أن يرمي خطأً يقطع الدورة.
   *
   * @param task - دالة التنظيف المراد تشغيلها.
   */
  private async _safe(task: () => Promise<unknown>): Promise<void> {
    try {
      await task();
    } catch (err) {
      logger.error("retention.cleanup_step_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
