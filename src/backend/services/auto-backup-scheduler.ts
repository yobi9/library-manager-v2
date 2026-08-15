import { getEventBus } from "./event-bus";
import type { DatabaseService } from "./database-service";
import type { SettingsService } from "./settings-service";
import { logger } from "../observability/logger";
import { trackBackgroundJob } from "../observability/operations";

/**
 * Runs scheduled database backups while `auto_backup_enabled` is true.
 *
 * Reads the interval from the `auto_backup_interval_hours` setting (in hours,
 * default 24) and re-applies the schedule whenever the `settings_updated`
 * event fires or when {@link start} is invoked. Mirrors the old project's
 * AutoBackupScheduler behavior so flipping the toggle on the admin database
 * page takes effect immediately without a server restart.
 */
export class AutoBackupScheduler {
  private _interval: ReturnType<typeof setInterval> | null = null;
  private _disposeEvent: (() => void) | null = null;

  constructor(
    private databaseService: DatabaseService,
    private settingsService: SettingsService,
    /** اختياري: مسند يعيد `true` عند وجود مسح نشط — يتخطى النسخة الاحتياطية حينها. */
    private isScanActive?: () => boolean,
  ) {}

  /**
   * Subscribes to setting changes and applies the current backup schedule.
   */
  async start(): Promise<void> {
    if (!this._disposeEvent) {
      this._disposeEvent = getEventBus().on("settings_updated", () => {
        void this._applySettings();
      });
    }
    await this._applySettings();
  }

  /**
   * Unsubscribes and clears any pending backup timer.
   */
  stop(): void {
    if (this._disposeEvent) {
      this._disposeEvent();
      this._disposeEvent = null;
    }
    this._clearInterval();
  }

  private _clearInterval(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  private async _applySettings(): Promise<void> {
    let enabled = false;
    let intervalHours = 24;
    try {
      const settings = await this.settingsService.getAllSettings();
      enabled = settings["auto_backup_enabled"] === true;
      const rawInterval = Number(settings["auto_backup_interval_hours"] ?? 24);
      intervalHours = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 24;
    } catch (err) {
      logger.error("autobackup.read_settings_failed", { message: String(err) });
      return;
    }

    this._clearInterval();
    if (enabled) {
      const intervalMs = intervalHours * 3600000;
      this._interval = setInterval(() => void this._runBackup(), intervalMs);
      this._interval.unref();
    }
  }

  private async _runBackup(): Promise<void> {
    // تخطّي الجولة أثناء مسح نشط: `VACUUM INTO` على الاتصال الرئيسي يتنافس مع
    // كاتب الماسح على قفل كتابة WAL ويعلق حتى `busy_timeout` أو يفشل — النسخة
    // تتأجل للدورة التالية (ساعات) والحذف/النسخ المؤجل لا يكسر أي عقد بيانات.
    if (this.isScanActive?.() === true) {
      logger.info("autobackup.skip_scan_active", {});
      return;
    }

    // يُسجَّل كوظيفة خلفية في شجرة العمليات (`background_job` بنوع
    // `auto_backup`) لرصد تداخله الزمني مع أي مسح/وظائف أخرى.
    await trackBackgroundJob(
      "background_job",
      "autoBackup",
      () => this.databaseService.createBackup(),
      { component: "AutoBackupScheduler" },
    );
  }
}
