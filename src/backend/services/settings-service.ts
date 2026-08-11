import { SettingsRepository } from "../repositories/settings-repository";
import { getEventBus } from "./event-bus";
import { CacheService } from "./cache-service";
import { CachePrefixes } from "./cache-prefixes";
import {
  getDefaultSettings,
  buildPublicSettings,
  validateSetting,
} from "../settings/settings-registry";
import type { PublicSettings } from "@/shared/types/settings";

/**
 * طبقة الخدمة للإعدادات — مسؤولة عن التحقق، بناء الـ DTO العام، وإعادة الضبط.
 *
 * الغرض: عزل منطق الإعدادات عن المستودع وعن الـ Controllers، وجعل
 * `SettingsRegistry` هو المصدر الوحيد للافتراضيات وقواعد التحقق.
 *
 * @remarks تحديث أي إعداد يطلق حدث `settings_updated` عبر الـ Event Bus
 *          حتى يتفاعل `AutoBackupScheduler` فوراً دون إعادة تشغيل.
 *
 *          قراءات الإعدادات تُخزَّن مؤقتاً في `CacheService` (بادئة `settings`)
 *          لأنها تحدث على كل طلب (مثل `viewer_access_mode` في Layout الزائر).
 *          الطزاجة مضمونة: كل تحديث/إعادة ضبط يمسح البادئة فوراً (awaited)
 *          والإبطال عبر `CacheInvalidator` يغطي مسار `settings_updated`.
 */
export class SettingsService {
  constructor(
    private settingsRepo: SettingsRepository,
    private cache: CacheService,
  ) {}

  /**
   * إرجاع كل الإعدادات المخزنة (بما فيها الإدارية) — للاستهلاك الخادمي فقط.
   *
   * @returns خريطة `key → value` مطبّعة من قاعدة البيانات (مخزّنة مؤقتاً).
   */
  async getAllSettings(): Promise<Record<string, unknown>> {
    return this.cache.withCache(
      CachePrefixes.settings,
      {},
      () => this.settingsRepo.getAllSettings(),
      this.cache.getTTL("short"),
    );
  }

  /**
   * إرجاع إعداد واحد عبر مفتاحه.
   *
   * @param key - مفتاح الإعداد.
   * @returns القيمة المطبّعة أو `null` إذا لم يكن الإعداد موجوداً.
   * @remarks لا يُخزَّن مؤقتاً — يُقرأ من قاعدة البيانات مباشرة لدعم قراءات
   *          الخلفية الحساسة للطزاجة (الماسح، الإثراء، تخزين الصور).
   */
  async getSetting(key: string): Promise<unknown> {
    return this.settingsRepo.getSetting(key);
  }

  /**
   * بناء الـ DTO العام (المفاتيح `isPublic === true` فقط) للواجهة العامة.
   *
   * @returns كائن `PublicSettings` كامل بكل المفاتيح العامة مع الافتراضيات.
   */
  async getPublicSettings(): Promise<PublicSettings> {
    const settings = await this.getAllSettings();
    return buildPublicSettings(settings) as PublicSettings;
  }

  /**
   * تحديث مجموعة إعدادات دفعة واحدة مع التحقق من كل مفتاح.
   *
   * @param settingsObj - خريطة `key → value` ليتم تحديثها.
   * @param userId - معرّف المستخدم المسؤول عن التغيير (لسجل التدقيق).
   * @param ip - عنوان IP الخاص بالتغيير (لسجل التدقيق).
   * @returns مصفوفة نتائج الإدراج/التحديث لكل مفتاح.
   * @throws `Error` إذا فشل تحقق أي إعداد أو فشلت العملية.
   */
  async updateSettings(
    settingsObj: Record<string, unknown>,
    userId?: number,
    ip?: string,
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const [key, value] of Object.entries(settingsObj)) {
      const validated = validateSetting(key, value);
      const result = await this.settingsRepo.upsertSetting(key, validated, userId, ip);
      getEventBus().emit("settings_updated", { key, value: validated, userId });
      results.push(result);
    }
    await this.cache.deleteByPrefix(CachePrefixes.settings);
    return results;
  }

  /**
   * إعادة ضبط جميع الإعدادات إلى قيمها الافتراضية المسجلة في السجل.
   *
   * يُعيد كتابة كل المفاتيح المسجلة بقيمها الافتراضية، ويحذف أي صف قديم
   * (مثل مفاتيح المشروع القديم) غير مسجل في السجل.
   *
   * @returns خريطة الافتراضات المطبّقة.
   */
  async resetSettings(): Promise<Record<string, unknown>> {
    const defaults = getDefaultSettings();
    for (const [key, value] of Object.entries(defaults)) {
      await this.settingsRepo.upsertSetting(key, value);
    }
    const stored = await this.settingsRepo.getAllSettings();
    for (const storedKey of Object.keys(stored)) {
      if (!(storedKey in defaults)) {
        await this.settingsRepo.deleteSetting(storedKey);
      }
    }
    await this.cache.deleteByPrefix(CachePrefixes.settings);
    return defaults;
  }

  /**
   * إرجاع معلومات النظام التشغيلي (إصدار Node، الذاكرة، حجم قاعدة البيانات).
   *
   * @returns كائن معلومات النظام.
   */
  async getSystemInfo() {
    const dbSize = await this.settingsRepo.getDbSize();
    return {
      node_version: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      db_size: dbSize,
    };
  }

  /**
   * إرجاع آخر سجلات تدقيق تغيير الإعدادات (للمدراء).
   *
   * @param limit - عدد السجلات المراد جلبها (افتراضياً 50).
   * @returns مصفوفة سجلات التدقيق مرتبة زمنياً تنازلياً.
   */
  async getAuditLog(limit = 50): Promise<unknown[]> {
    return this.settingsRepo.getAuditLog(limit);
  }

  /**
   * يحذف سجلات تدقيق الإعدادات الأقدم من `days` يوماً (تنظيف دوري).
   *
   * @param days - عدد أيام الاحتفاظ (افتراضياً 180 يوماً).
   */
  async deleteOldAuditLog(days = 180) {
    return this.settingsRepo.deleteOldAuditLog(days);
  }
}
