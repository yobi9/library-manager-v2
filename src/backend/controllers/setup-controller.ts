import { BaseController, type RequestContext } from "./base-controller";
import { SetupService, SETUP_ALREADY_INITIALIZED } from "../services/setup-service";

/**
 * متحكم التهيئة الأولى — يكشف حالتين فقط: قراءة حالة الإعداد، وإنشاء أول مدير.
 *
 * - النطاق: عام بلا مصادقة (شرطا الوصول: النظام غير مهيأ + بوابة الـ proxy
 *   لا تحمي /setup أصلاً لأنها خارج قوائمه)؛ بعد اكتمال الإعداد يرفض كل POST
 *   بـ 409 وتظل الصفحة تعيد التوجيه إلى /login.
 */
export class SetupController extends BaseController {
  constructor(private setupService: SetupService) {
    super();
  }

  /**
   * يعيد حالة تهيئة النظام (مشتقة من عدد المستخدمين لحظياً).
   *
   * @returns `{ initialized: boolean }` دائماً 200.
   */
  async getStatus() {
    const status = await this.setupService.getStatus();
    return this.ok(status);
  }

  /**
   * ينشئ حساب المدير الأول — لمرة واحدة عبر عمر قاعدة البيانات.
   *
   * - الترجمة: مهيأ مسبقاً ⇒ 409؛ مدخلات ناقصة ⇒ 400؛ اسم مكرر ⇒ 409؛
   *   ما عداه عبر `handleError` (500 افتراضياً).
   *
   * @param body - جسم الطلب: username/password إلزاميان، display_name/email اختياريان.
   * @param ctx - سياق الطلب (IP/UA للتدقيق).
   * @returns 201 مع المستخدم المُنشأ (بلا تجزئة كلمة المرور) عند النجاح.
   */
  async createFirstAdmin(body: Record<string, unknown>, ctx: RequestContext) {
    try {
      const result = await this.setupService.createFirstAdmin(
        {
          username: typeof body["username"] === "string" ? body["username"] : "",
          password: typeof body["password"] === "string" ? body["password"] : "",
          display_name:
            typeof body["display_name"] === "string" ? body["display_name"] : undefined,
          email: typeof body["email"] === "string" ? body["email"] : undefined,
        },
        ctx.ip,
        ctx.userAgent,
      );
      return this.created(result, "تم إنشاء حساب المدير الأول بنجاح");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === SETUP_ALREADY_INITIALIZED) {
        return this.error("تم إكمال الإعداد مسبقاً — يوجد مستخدم مسجل في النظام", 409);
      }
      if (msg === "Username and password are required") return this.error(msg, 400);
      if (msg === "Username already exists") return this.error(msg, 409);
      return this.handleError(err);
    }
  }
}
