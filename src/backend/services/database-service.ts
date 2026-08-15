import { DatabaseRepository } from "../repositories/database-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { CacheService } from "./cache-service";
import { CachePrefixes } from "./cache-prefixes";
import { closeDatabase } from "../db/db";
import { logger } from "../observability/logger";
import { ensureDirs } from "../utils/path-utils";
import fs from "fs/promises";
import path from "path";

const BACKUP_EXTENSIONS = new Set([".db", ".zip"]);

/**
 * TTL (بالثواني) لإحصاءات قاعدة البيانات (Phase 6).
 *
 * @remarks `getStats`/`getTables` تنفّذ COUNT على كل جدول (≈23 استعلام) —
 *          مكلفة وتُستدعى من لوحة الأدمن. الكاش 60 ثانية مع إبطال فوري عبر
 *          بادئة `database` عند أي `scan_completed` (والتي يصفّيها
 *          `CacheInvalidator`) وعبر purge يدوي بعد الاستعادة/التفريغ/التحسين.
 */
const DATABASE_CACHE_TTL_SECONDS = 60;

/**
 * Backup file entry returned by {@link DatabaseService.getBackupsList}.
 *
 * Mirrors the old project's list shape so the admin UI can render the same
 * filename / size / relative-time columns.
 */
export interface BackupFileInfo {
  name: string;
  size: string;
  timeLabel: string;
  mtime: number;
}

export class DatabaseService {
  private dbRepo = new DatabaseRepository();

  constructor(
    private activityRepo: ActivityRepository,
    private cache: CacheService,
    /** اختياري: مسند يعيد `true` عند وجود مسح نشط — يرفض العمليات المدمرة/الصيانة حينها. */
    private isScanActive?: () => boolean,
  ) {
    // إنشاء مجلد النسخ الاحتياطية `data/backups` عند بدء التشغيل (أول بناء
    // للخدمة) — أي فشل يُسجَّل فقط ولا يعطّل تهيئة باقي الخدمات.
    void this.ensureDirectories();
  }

  /**
   * يضمن وجود مجلد النسخ الاحتياطية المحلية `data/backups` المستخدم من
   * النسخ التلقائية (`AutoBackupScheduler`) وقائمة النسخ المحلية.
   *
   * - المسار مصدره `getBackupDir()` (ثابت نسبي لجذر المشروع) فلا يوجد إعداد
   *   مؤثر عليه ولا اشتراك في أحداث `settings_updated`.
   * - السلوك: لا يرمي الخطأ أبداً — الفشل يُسجَّل عبر `logger` فقط.
   *
   * @returns وعد ينجز عند ضمان وجود المجلد (أو تسجيل الفشل).
   */
  async ensureDirectories(): Promise<void> {
    try {
      await ensureDirs([this.getBackupDir()], "DatabaseService");
    } catch (err) {
      logger.error("database.dirs_ensure_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * يرفض تنفيذ عملية كتابة/صيانة ثقيلة على القاعدة أثناء مسح نشط.
   *
   * `VACUUM INTO` و`PRAGMA optimize` و`truncateAll` واستبدال الملف كلها عمليات
   * تتنافس مع كاتب الماسح على قفل كتابة WAL (وتصل أحياناً إلى إغلاق الاتصال
   * نفسه في حالة الاستعادة) — الحارس يعيد رسالة عربية واضحة بدل فشل غامض.
   *
   * @param action - وصف العملية المرفوضة لعرضه في رسالة الخطأ.
   * @throws Error عندما يكون مسح قيد التشغيل.
   */
  private guardAgainstActiveScan(action: string): void {
    if (this.isScanActive?.() === true) {
      throw new Error(
        `لا يمكن ${action} أثناء مسح قيد التشغيل؛ انتظر اكتمال المسح ثم أعد المحاولة`,
      );
    }
  }

  /**
   * Returns database size, table list and total record count.
   *
   * @remarks Heavy (≈46 COUNT queries across 23 tables) so the combined payload
   *          is cached for {@link DATABASE_CACHE_TTL_SECONDS}; freshness comes
   *          from the `database` prefix purge on `scan_completed` and after
   *          restore/factory-reset/optimize mutations.
   */
  async getStats() {
    return this.cache.withCache(
      CachePrefixes.database,
      { kind: "stats" },
      async () => {
        const [size, tables, totalRecords] = await Promise.all([
          this.dbRepo.getDbSize(),
          this.dbRepo.getTables(),
          this.dbRepo.getTotalRecords(),
        ]);
        return { size, tables, totalRecords };
      },
      DATABASE_CACHE_TTL_SECONDS,
    );
  }

  /**
   * ينشئ نسخة احتياطية كاملة من قاعدة البيانات في مجلد `data/backups` باسم
   * يحمل الطابع الزمني (`backup-{ISO-بتوقيت-غرينتش}.db`) ويُبقيها على القرص.
   *
   * - المصدر الوحيد لإنشاء النسخ: تستخدمه النسخة اليدوية («إنشاء نسخة الآن»)
   *   والجدولة التلقائية (`AutoBackupScheduler`) معاً — لا يُنشأ أي ملف عند
   *   النقر على زر التنزيل؛ الزر يقرأ الملف الموجود فقط.
   * - السلوك: `VACUUM INTO` إلى المسار النهائي ثم تسجيل حدث `db_backup`
   *   وإبطال كاش إحصاءات قاعدة البيانات.
   *
   * @returns مسار الملف المُنشأ وحجمه المنسّق لعرضه في القائمة.
   * @throws عندما يكون مسح قيد التشغيل أو يفشل إنشاء النسخة نفسها.
   */
  async createBackup() {
    this.guardAgainstActiveScan("إنشاء نسخة احتياطية");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = this.getBackupDir();
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);
    await this.dbRepo.backup(backupPath);
    const size = await this.dbRepo.getDbSize();
    await this.activityRepo.logActivity({
      entityType: "system",
      action: "db_backup",
      module: "database",
      severity: "success",
      details: { size: size.formatted, path: backupPath },
    });
    await this.cache.deleteByPrefix(CachePrefixes.database);
    return { path: backupPath, size: size.formatted };
  }

  async optimize() {
    this.guardAgainstActiveScan("تحسين قاعدة البيانات");
    await this.dbRepo.optimize();
    await this.activityRepo.logActivity({
      entityType: "system",
      action: "db_optimize",
      module: "database",
      severity: "success",
      details: { type: "optimize" },
    });
    await this.cache.deleteByPrefix(CachePrefixes.database);
    return { success: true };
  }

  async getDbSize() {
    return this.dbRepo.getDbSize();
  }

  async getTables() {
    return this.cache.withCache(
      CachePrefixes.database,
      { kind: "tables" },
      () => this.dbRepo.getTables(),
      DATABASE_CACHE_TTL_SECONDS,
    );
  }

  /**
   * Lists local backup files (`.db` / `.zip`) inside `data/backups`, newest
   * first. Each entry carries a human-friendly size and Arabic relative time
   * label for display in the admin UI.
   *
   * @returns Backup files sorted by modification time (descending).
   */
  async getBackupsList(): Promise<BackupFileInfo[]> {
    const backupDir = this.getBackupDir();
    await fs.mkdir(backupDir, { recursive: true });
    const entries = await fs.readdir(backupDir);
    const now = Date.now();
    const backups: BackupFileInfo[] = [];
    for (const name of entries) {
      if (!BACKUP_EXTENSIONS.has(path.extname(name).toLowerCase())) continue;
      const filePath = path.join(backupDir, name);
      const stat = await fs.stat(filePath);
      backups.push({
        name,
        size: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
        timeLabel: this.formatArabicTime(stat.mtime, now),
        mtime: stat.mtime.getTime(),
      });
    }
    backups.sort((a, b) => b.mtime - a.mtime);
    return backups;
  }

  /**
   * Restores the database by replacing the main DB file with the uploaded
   * backup. The active connection is closed first (SQLite locks the file),
   * then the file content is written to the DB path. A subsequent request
   * re-initializes a fresh connection against the restored file; the app is
   * expected to be restarted afterwards so migrations run cleanly.
   *
   * @param file - Uploaded backup file (`.db` only in the new format).
   */
  async restoreBackup(file: File): Promise<void> {
    // الحارس هنا أشد أهمية: الاستعادة تغلق اتصال الكاتب (`closeDatabase`) حتى
    // لو كان الماسح في منتصف سياقه، فيكمل على كائن مغلق ويفشل بلا سبب واضح.
    this.guardAgainstActiveScan("استعادة قاعدة البيانات");
    const ext = path.extname(file.name).toLowerCase();
    if (ext !== ".db") {
      throw new Error("الرجاء رفع ملف نسخة احتياطية بصيغة .db");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength === 0) {
      throw new Error("الملف المرفوع فارغ");
    }
    await closeDatabase();
    const mainDbPath = this.dbRepo.getDbPath();
    await fs.writeFile(mainDbPath, buffer);
    // سجّل الحدث بعد الكتابة داخل الملف المستعاد نفسه — الواجهة تطلّب إعادة
    // تشغيل بعد الاستعادة، فيظهر الحدث في قاعدة البيانات المستعادة.
    await this.activityRepo
      .logActivity({
        entityType: "system",
        action: "db_restore",
        module: "database",
        severity: "success",
        details: { filename: file.name, size: buffer.byteLength },
      })
      .catch((err: Error) => {
        console.error("[DatabaseService] Failed to log restore:", err.message);
      });
    await this.cache.deleteByPrefix(CachePrefixes.database);
  }

  /**
   * Resets all user data by truncating every non-system table.
   */
  async performFactoryReset(): Promise<void> {
    this.guardAgainstActiveScan("تصفير قاعدة البيانات");
    // لا يمكن تسجيل factory_reset في `activities`/`security_events` لأن
    // truncateAll يمسح هذين الجدولين — نكتفي بسطر سجل للعامل لا يُمحى.
    console.warn("[DatabaseService] Factory reset executed — all user data truncated.");
    await this.dbRepo.truncateAll();
    await this.cache.deleteByPrefix(CachePrefixes.database);
  }

  /**
   * Resolves the absolute path of a backup file inside the backups directory.
   * Filenames are validated by the caller before reaching this method.
   *
   * @param filename - Backup file name (e.g. `backup-2024-01-01.db`).
   * @returns Absolute path to the requested backup file.
   */
  getBackupPath(filename: string): string {
    return path.join(this.getBackupDir(), filename);
  }

  private getBackupDir(): string {
    return path.join(process.cwd(), "data", "backups");
  }

  private formatArabicTime(date: Date, now: number): string {
    const diffInHours = Math.floor((now - date.getTime()) / 3600000);
    if (diffInHours < 1) return "منذ قليل";
    if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
    return `منذ ${Math.floor(diffInHours / 24)} يوم`;
  }
}
