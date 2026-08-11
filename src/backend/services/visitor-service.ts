import { VisitorRepository } from "../repositories/visitor-repository";
import { ActivityRepository } from "../repositories/activity-repository";

/** أنواع الأجهزة المعروفة المستخرجة من `User-Agent`. */
export type DeviceType =
  "windows" | "android" | "apple" | "smart_tv" | "samsung" | "huawei" | "other";

/**
 * استنتاج نوع الجهاز من سلسلة `User-Agent`.
 *
 * @param userAgent - سلسلة وكيل المستخدم.
 * @returns نوع الجهاز (`windows`/`android`/`apple`/`smart_tv`/`samsung`/`huawei`/`other`).
 */
export function detectDeviceType(userAgent: string): DeviceType {
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|Mac/i.test(userAgent)) return "apple";
  if (/SmartTV|TV/i.test(userAgent)) return "smart_tv";
  if (/Samsung/i.test(userAgent)) return "samsung";
  if (/Huawei/i.test(userAgent)) return "huawei";
  return "other";
}

export class VisitorService {
  constructor(
    private visitorRepo: VisitorRepository,
    private activityRepo?: ActivityRepository,
  ) {}

  /**
   * تسجيل زيارة لواجهة عامة — يحسب نوع الجهاز تلقائياً ثم يكتب/يحدّث
   * صف الزائر ويدرج حدث `visit`.
   *
   * @param opts.sessionId - معرّف جلسة الزائر (من كعكة `visitor_session_id`).
   * @param opts.ip - عنوان IP.
   * @param opts.userAgent - سلسلة `User-Agent`.
   * @param opts.deviceId - معرّف جهاز (اختياري؛ يُستخدم `sessionId` بديلاً عند غيابه).
   * @returns نتيجة العملية من المستودع.
   */
  async trackView(opts: {
    sessionId: string;
    ip: string;
    userAgent: string;
    deviceId?: string | null;
  }) {
    const deviceType = detectDeviceType(opts.userAgent);
    return this.visitorRepo.updateVisitorActivity(
      opts.sessionId,
      opts.ip,
      opts.userAgent,
      deviceType,
      opts.deviceId ?? "",
    );
  }

  async getVisitors() {
    return this.visitorRepo.getVisitors();
  }

  async getVisitorLogs(limit = 10, offset = 0) {
    return this.visitorRepo.getVisitorLogs(limit, offset);
  }

  async getOnlineCount() {
    return this.visitorRepo.getOnlineCount();
  }

  async getDeviceBreakdown() {
    return this.visitorRepo.getDeviceBreakdown();
  }

  async getVisitorRequests() {
    return this.visitorRepo.getVisitorRequests();
  }

  async addVisitorRequest(userId: string, message: string, ip?: string, userAgent?: string) {
    const result = await this.visitorRepo.addVisitorRequest(userId, message, ip, userAgent);
    if (this.activityRepo) {
      void this.activityRepo
        .logActivity({
          entityType: "visitor",
          action: "new_request",
          module: "requests",
          severity: "info",
          details: { message: message.slice(0, 200), deviceId: userId },
          ip,
          userAgent,
        })
        .catch((err: Error) => {
          console.error("[VisitorService] Failed to log new request:", err.message);
        });
    }
    return result;
  }

  async addReplyToRequest(requestId: number, reply: string) {
    const result = await this.visitorRepo.addReplyToRequest(requestId, reply);
    if (this.activityRepo) {
      void this.activityRepo
        .logActivity({
          entityType: "system",
          action: "request_replied",
          module: "requests",
          severity: "info",
          details: { requestId, reply: reply.slice(0, 200) },
        })
        .catch((err: Error) => {
          console.error("[VisitorService] Failed to log request reply:", err.message);
        });
    }
    return result;
  }

  async deleteRequest(requestId: number) {
    const result = await this.visitorRepo.deleteRequest(requestId);
    if (this.activityRepo) {
      void this.activityRepo
        .logActivity({
          entityType: "system",
          action: "request_deleted",
          module: "requests",
          severity: "info",
          details: { requestId },
        })
        .catch((err: Error) => {
          console.error("[VisitorService] Failed to log request deletion:", err.message);
        });
    }
    return result;
  }

  async deleteAllRequests() {
    const result = await this.visitorRepo.deleteAllVisitorRequests();
    if (this.activityRepo) {
      void this.activityRepo
        .logActivity({
          entityType: "system",
          action: "requests_deleted",
          module: "requests",
          severity: "info",
          details: {},
        })
        .catch((err: Error) => {
          console.error("[VisitorService] Failed to log bulk request deletion:", err.message);
        });
    }
    return result;
  }

  /**
   * يحذف أحداث زيارات الزوار الأقدم من `days` يوماً (تنظيف دوري).
   *
   * @param days - عدد أيام الاحتفاظ (افتراضياً 7 أيام).
   */
  async deleteOldVisitorEvents(days = 7) {
    return this.visitorRepo.deleteOldVisitorEvents(days);
  }
}
