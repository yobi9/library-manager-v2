import type { SettingsService } from "./settings-service";
import type { AuthService } from "./auth-service";
import type { VisitorService } from "./visitor-service";

/**
 * إدخالات تقييم حارس الوصول للواجهة العامة — مجمّعة من كوكيز/هيدرات الطلب.
 */
export interface ViewerAccessInput {
  /** رمز الجلسة من كعكة `session_token` (إن وُجد). */
  sessionToken?: string;
  /** معرّف جلسة الزائر (من هيدر `x-visitor-session-id` أو كعكة `visitor_session_id`). */
  visitorSessionId?: string;
  /** عنوان IP للطلب. */
  ip?: string;
  /** سلسلة `User-Agent` للطلب. */
  userAgent?: string;
}

/**
 * قرار حارس الوصول — نتيجة تقييم واحدة تُستهلك من `(viewer)/layout.tsx`.
 */
export interface ViewerAccessDecision {
  /** قيمة إعداد `viewer_access_mode` ("public"/"protected"/غير مضبوطة). */
  mode: string | undefined;
  /** هل وضع الصيانة مفعّل؟ */
  maintenanceMode: boolean;
  /** هل طالب الوصول مدير (رمز جلسة صالح بـ `is_admin`)؟ */
  isAdmin: boolean;
  /** هل يوجد رمز جلسة صالح (مستخدم مسجّل دخول أو مدير)؟ */
  isAuthenticated: boolean;
}

/**
 * حارس الوصول المركزي للواجهة العامة — يُركّز منطق الحماية الذي كان مبعثراً
 * في `(viewer)/layout.tsx`: قراءة إعدادات الوصول (`viewer_access_mode` +
 * `maintenance_mode`) من قاعدة البيانات، التحقق من رمز الجلسة، وتتبع الزيارات
 * كعملية Best-Effort لا تُسقط الصفحة عند فشلها.
 */
export class ViewerAccessService {
  constructor(
    private settingsService: SettingsService,
    private authService: AuthService,
    private visitorService: VisitorService,
  ) {}

  /**
   * يقيّم سياسة الوصول للطلب الحالي:
   *
   * - يقرأ إعدادات الوصول من قاعدة البيانات (`viewer_access_mode` و`maintenance_mode`).
   * - يتحقق من صلاحية رمز الجلسة ويحدد هل الطالب مدير.
   * - عند وجود زيارة زائر غير مدير، يسجّلها كعملية Best-Effort (أي فشل في
   *   التتبع يُسجَّل فقط ولا يُسقط الصفحة).
   *
   * @param input - إدخالات الطلب المجمّعة من الكوكيز/الهيدرات.
   * @returns قرار الحماية الذي تتصرف بناءً عليه الواجهة العامة.
   */
  async evaluateAccess(input: ViewerAccessInput): Promise<ViewerAccessDecision> {
    const settings = await this.settingsService.getAllSettings();
    const mode = settings["viewer_access_mode"] as string | undefined;
    const maintenanceMode = settings["maintenance_mode"] === true;

    const payload = input.sessionToken
      ? this.authService.verifyToken(input.sessionToken)
      : null;
    const isAdmin = payload?.["is_admin"] === true;

    if (input.visitorSessionId && !isAdmin) {
      try {
        await this.visitorService.trackView({
          sessionId: input.visitorSessionId,
          ip: input.ip || "127.0.0.1",
          userAgent: input.userAgent || "",
        });
      } catch (error) {
        // التتبع غير حرج (Best-Effort): أي فشل (تعارض مؤقت مع كاتب الماسح أو
        // غيرها) يُسجَّل فقط ونكمل عرض الصفحة.
        console.error(
          "[ViewerAccessService] Visitor tracking failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return { mode, maintenanceMode, isAdmin, isAuthenticated: payload !== null };
  }
}
