import { BaseRepository } from "./base-repository";
import { getDatabase, resolveDbPath } from "../db/db";
import { getSettingDefinition } from "../settings/settings-registry";
import fs from "fs/promises";
import path from "path";

/**
 * يُقنّع قيمة سرية قبل تسجيلها في سجل تدقيق الإعدادات.
 *
 * @param value - القيمة النصية الأصلية (قد تكون `null`).
 * @returns `"***"` عند وجود قيمة غير فارغة، أو القيمة نفسها (null/فارغة) كما هي.
 */
function maskSecretValue(value: string | null): string | null {
  if (value === null || value === undefined || value === "") return value;
  return "***";
}

/**
 * طبقة الوصول للبيانات الخاصة بالإعدادات.
 *
 * الغرض: قراءة وكتابة جدول `settings` مع تحويل القيم وفق `data_type`
 * (boolean/number/json/string)، وتسجيل كل تغيير في `settings_audit_log`.
 */
export class SettingsRepository extends BaseRepository {
  constructor() {
    super("settings");
  }

  /**
   * إرجاع جميع الإعدادات المخزنة كمفاتيح بقيم مطبّعة.
   *
   * @returns خريطة `key → value` حيث القيمة محوّلة حسب `data_type`.
   */
  async getAllSettings() {
    const db = await getDatabase();
    const rows = (await db.all("SELECT key, value, data_type FROM settings")) as {
      key: string;
      value: string | null;
      data_type: string;
    }[];
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      settings[row.key] = this.normalizeValue(row.value, row.data_type);
    }
    return settings;
  }

  /**
   * إرجاع إعداد واحد عبر مفتاحه.
   *
   * @param key - مفتاح الإعداد.
   * @returns القيمة المطبّعة أو `null` إذا لم يوجد الصف.
   */
  async getSetting(key: string): Promise<unknown> {
    const db = await getDatabase();
    const row = (await db.get("SELECT value, data_type FROM settings WHERE key = ?", [key])) as
      { value: string | null; data_type: string } | undefined;
    if (!row) return null;
    return this.normalizeValue(row.value, row.data_type);
  }

  /**
   * إدراج أو تحديث إعداد واحد مع تسجيل التغيير في سجل التدقيق.
   *
   * يحفظ القيمة بتمثيل نصي (string) ويحسب `data_type` من نوع القيمة
   * (json/boolean/number/string). فشل كتابة التدقيق لا يُفشل العملية.
   *
   * @param key - مفتاح الإعداد.
   * @param value - القيمة المراد حفظها.
   * @param userId - معرّف المستخدم المسؤول (اختياري، لسجل التدقيق).
   * @param ipAddress - عنوان IP (اختياري، لسجل التدقيق).
   * @returns `{ key, value }` حيث `value` هي التمثيل النصي المخزن.
   *
   * @remarks إذا كان الإعداد مسجّلاً في `SETTINGS_REGISTRY` بعلم `isSecret`
   *          فتُقنّع قيمتا `old_value` و`new_value` في `settings_audit_log`
   *          (تُستبدل بـ`***`) حتى لا يتسرب المفتاح في سجلات التدقيق.
   */
  async upsertSetting(
    key: string,
    value: unknown,
    userId?: number | null,
    ipAddress?: string | null,
  ) {
    const db = await getDatabase();
    const valueType = typeof value;
    const isJsonValue = valueType === "object" && value !== null;

    let dataType: string;
    let normalized: string;
    if (isJsonValue) {
      dataType = "json";
      normalized = JSON.stringify(value);
    } else if (valueType === "boolean") {
      dataType = "boolean";
      normalized = value ? "true" : "false";
    } else if (valueType === "number") {
      dataType = "number";
      normalized = String(value);
    } else {
      dataType = "string";
      normalized = String(value);
    }

    let oldValue: string | null = null;
    try {
      const oldRow = (await db.get("SELECT value FROM settings WHERE key = ?", [key])) as
        { value: string } | undefined;
      oldValue = oldRow?.value ?? null;
    } catch {
      // ignore
    }

    const isSecret = getSettingDefinition(key)?.isSecret === true;
    const auditOldValue = isSecret ? maskSecretValue(oldValue) : oldValue;
    const auditNewValue = isSecret ? maskSecretValue(normalized) : normalized;

    await db.run(
      `INSERT INTO settings (key, value, data_type, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         data_type = excluded.data_type,
         updated_at = CURRENT_TIMESTAMP`,
      [key, normalized, dataType],
    );

    try {
      await db.run(
        `INSERT INTO settings_audit_log (setting_key, old_value, new_value, changed_at, user_id, ip_address)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
        [key, auditOldValue, auditNewValue, userId ?? null, ipAddress ?? null],
      );
    } catch {
      // audit log failure is non-fatal
    }

    return { key, value: normalized };
  }

  /**
   * حذف إعداد من قاعدة البيانات.
   *
   * @param key - مفتاح الإعداد المراد حذفه.
   * @returns `true` إذا تم حذف صف فعلياً.
   */
  async deleteSetting(key: string) {
    const db = await getDatabase();
    const result = await db.run("DELETE FROM settings WHERE key = ?", [key]);
    return (result.changes ?? 0) > 0;
  }

  /**
   * جلب آخر سجلات تدقيق تغيير الإعدادات.
   *
   * @param limit - عدد السجلات (افتراضياً 50).
   * @returns مصفوفة السجلات مرتبة زمنياً تنازلياً.
   */
  async getAuditLog(limit = 50) {
    const db = await getDatabase();
    return (await db.all(
      `SELECT setting_key, old_value, new_value, changed_at, user_id, ip_address
       FROM settings_audit_log
       ORDER BY changed_at DESC
       LIMIT ?`,
      [Math.min(Math.max(limit, 1), 200)],
    )) as Array<{
      setting_key: string;
      old_value: string | null;
      new_value: string;
      changed_at: string;
      user_id: number | null;
      ip_address: string | null;
    }>;
  }

  /**
   * يحذف سجلات تدقيق تغيير الإعدادات الأقدم من `days` يوماً (تنظيف دوري).
   *
   * @param days - عدد أيام الاحتفاظ (افتراضياً 180 يوماً).
   */
  async deleteOldAuditLog(days = 180) {
    const db = await getDatabase();
    await db.run(
      `DELETE FROM settings_audit_log WHERE changed_at < datetime('now', '-' || ? || ' days')`,
      [days],
    );
  }

  /**
   * حساب حجم ملف قاعدة البيانات الحالي.
   *
   * @returns الحجم بالبايتات مع تمثيل نصي مقروء (KB/MB).
   */
  async getDbSize() {
    const dbPath = resolveDbPath();
    let fileSizeBytes = 0;
    try {
      const stat = await fs.stat(path.resolve(dbPath));
      fileSizeBytes = stat.size;
    } catch {
      // file may not exist yet
    }
    const formatted =
      fileSizeBytes > 1048576
        ? `${(fileSizeBytes / 1048576).toFixed(2)} MB`
        : `${(fileSizeBytes / 1024).toFixed(2)} KB`;
    return { bytes: fileSizeBytes, formatted };
  }

  /**
   * تحويل القيمة النصية المخزنة إلى النوع المناسب وفق `data_type`.
   *
   * @param value - القيمة النصية من قاعدة البيانات (قد تكون null).
   * @param dataType - نوع البيانات المخزن.
   * @returns القيمة المحوّلة (boolean/number/json/string).
   */
  private normalizeValue(value: string | null, dataType: string): unknown {
    if (value === null || value === undefined) return null;
    switch (dataType) {
      case "boolean":
        return value === "true" || value === "1";
      case "number":
        return Number(value);
      case "json":
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      default:
        return value;
    }
  }
}
