import { BaseController } from "./base-controller";
import type { SettingsService } from "../services/settings-service";

/**
 * وحدة تحكم الإعدادات — تنسيق الطلبات بين الـ API routes وطبقة الخدمة.
 */
export class SettingsController extends BaseController {
  constructor(private settingsService: SettingsService) {
    super();
  }

  /**
   * إرجاع الإعدادات العامة للواجهة العامة (بدون مصادقة).
   */
  async getPublic() {
    try {
      const settings = await this.settingsService.getPublicSettings();
      return this.ok(settings);
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * إرجاع كل الإعدادات (مصادقة أدمن).
   */
  async getAll() {
    try {
      const settings = await this.settingsService.getAllSettings();
      return this.ok(settings);
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * تحديث مجموعة إعدادات مع تتبّع المستخدم المسؤول في سجل التدقيق.
   *
   * @param data - خريطة `key → value`.
   * @param userId - معرّف المستخدم (اختياري).
   * @param ip - عنوان IP (اختياري).
   */
  async update(data: Record<string, unknown>, userId?: number, ip?: string) {
    try {
      await this.settingsService.updateSettings(data, userId, ip);
      return this.ok(null, "Settings updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * إرجاع معلومات النظام التشغيلي (مصادقة أدمن).
   */
  async getSystemInfo() {
    try {
      const info = await this.settingsService.getSystemInfo();
      return this.ok(info);
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * إعادة ضبط الإعدادات إلى الافتراضيات (مصادقة أدمن).
   */
  async reset() {
    try {
      const defaults = await this.settingsService.resetSettings();
      return this.ok(defaults, "Settings reset to defaults");
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * إرجاع سجل تدقيق تغيير الإعدادات (مصادقة أدمن).
   */
  async getAuditLog(limit?: number) {
    try {
      const logs = await this.settingsService.getAuditLog(limit);
      return this.ok(logs);
    } catch (err) {
      return this.handleError(err);
    }
  }
}
