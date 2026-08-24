import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/user-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { SecurityEventRepository } from "../repositories/security-repository";

/**
 * رسالة الخطأ المرجعية عندما يكون النظام مهيأً مسبقاً (يوجد مستخدم واحد على الأقل).
 *
 * - الغرض: تمكين المتحكم من ترجمة الحالة إلى HTTP 409 دون تسريب تفاصيل داخلية،
 *   ولتمكين الاختبارات من التحقق من الرفض بدقة.
 */
export const SETUP_ALREADY_INITIALIZED = "SETUP_ALREADY_INITIALIZED";

/**
 * حالة تهيئة النظام مشتقة من قاعدة البيانات مباشرة.
 *
 * - المصدر: عدد صفوف جدول `users` — لا علمة ولا إعداد مخزَّن؛ النظام
 *   UNINITIALIZED ⇔ الصفوف صفر. هذا يمنع أي انحراف بين الحالة والواقع.
 */
export interface SetupStatus {
  /** true بعد إنشاء أول مستخدم (مهما كانت صلاحياته) — الإعداد لمرة واحدة اكتمل. */
  initialized: boolean;
}

/**
 * مدخلات إنشاء حساب المدير الأول عبر معالج التهيئة لمرة واحدة.
 *
 * - النطاق: نفس حقول التسجيل القياسية؛ لا أدوار ولا حقول إضافية.
 */
export interface FirstAdminInput {
  /** اسم المستخدم الفريد (UNIQUE في المخطط). */
  username: string;
  /** كلمة المرور الخام — تُخزَّن مشتتة bcrypt فقط. */
  password: string;
  /** اسم العرض الاختياري؛ يسقط إلى اسم المستخدم عند الغياب. */
  display_name?: string;
  /** بريد اختياري. */
  email?: string;
}

/** المستخدم المُنشأ بعد إخفاء تجزئة كلمة المرور. */
export type SanitizedFirstAdmin = Omit<
  Record<string, unknown>,
  "password"
> & { user_id: number };

/**
 * خدمة التهيئة الأولى — تزيل حصار التثبيت النظيف (users فارغ ⇒ لا أحد يستطيع
 * الدخول لأن إنشاء المستخدمين يتطلب مديراً قائماً).
 *
 * - السلوك: عملية «أول مدير» لمرة واحدة مشروطة بمستخدمين == 0، بإعادة فحص
 *   **داخل** المعاملة (`withTransaction` → `withExclusiveTransaction`) حتى لا
 *   ينشئ تسابقان متزامنان مديرين اثنين؛ قاعدة SQLite أحادية الكاتب + قائمة انتظار
 *   FIFO للـ SAVEPOINT تضمن تسلسل الفحص-ثم-الإدراج.
 * - إعادة استخدام: نفس تحقق `AuthService.register` ونفس bcrypt(10) — لا تشفير
 *   جديد ولا آلية تسجيل عامة جديدة؛ `register()` يبقى غير مكشوف عبر أي route.
 * - التدقيق: activity_log + security_events بالآليات القائمة (action =
 *   `first_admin_created`).
 */
export class SetupService {
  /**
   * @param userRepo - مستودع المستخدمين (عدّ + بحث + إنشاء).
   * @param activityRepo - مستودع سجل الأنشطة للتدقيق.
   * @param securityRepo - مستودع أحداث الأمان للتدقيق الأمني.
   */
  constructor(
    private userRepo: UserRepository,
    private activityRepo: ActivityRepository,
    private securityRepo: SecurityEventRepository,
  ) {}

  /**
   * يقرأ حالة التهيئة من قاعدة البيانات لحظياً (لا كاش ولا علمة مخزنة).
   *
   * @returns `{ initialized: true }` عند وجود أي مستخدم، وإلا false.
   */
  async getStatus(): Promise<SetupStatus> {
    const usersCount = await this.userRepo.count();
    return { initialized: usersCount > 0 };
  }

  /**
   * ينشئ حساب المدير الأول لمرة واحدة فقط.
   *
   * - التسلسل: تحقق مدخلات → تشتيت bcrypt خارج القفل → معاملة حصرية تعيد فحص
   *   العدد ثم تفحص تكرار اسم المستخدم ثم تُدرج `is_admin=1` → تدقيق بعد الإرسال.
   * - الفشل: المدخلات ناقصة ⇒ «Username and password are required»؛ النظام مهيأ
   *   ⇒ `SETUP_ALREADY_INITIALIZED`؛ اسم مكرر ⇒ «Username already exists».
   *
   * @param input - اسم المستخدم وكلمة المرور والاختيارات.
   * @param ip - عنوان IP الطالب (للتدقيق).
   * @param userAgent - وكيل المستخدم (للتدقيق).
   * @returns المستخدم المُنشأ بلا تجزئة كلمة المرور.
   * @throws Error برسائل مرجعية ثابتة يترجمها المتحكم إلى أكواد HTTP.
   */
  async createFirstAdmin(
    input: FirstAdminInput,
    ip: string,
    userAgent: string,
  ): Promise<SanitizedFirstAdmin> {
    const { username, password, display_name, email } = input;
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    // التشتيت خارج المعاملة حتى لا يحتجز op بطيء قفل الحصرية.
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await this.userRepo.withTransaction(async () => {
      // إعادة الفحص داخل المعاملة: أي نداء ثانٍ (حتى متزامن) يدخل هنا بعد
      // اكتمال الأول ويجد عدداً > 0 فيفشل — لا مديران أبداً.
      const usersCount = await this.userRepo.count();
      if (usersCount > 0) throw new Error(SETUP_ALREADY_INITIALIZED);

      const existing = await this.userRepo.findByUsername(username);
      if (existing) throw new Error("Username already exists");

      return this.userRepo.create({
        username,
        password: hashedPassword,
        email: email ?? null,
        display_name: display_name || username,
        is_admin: 1,
        is_blocked: 0,
      });
    });

    const userId = (newUser as { user_id: number }).user_id;

    // تدقيق بالآليات القائمة — نفس نمط logActivity في register().
    await this.activityRepo.logActivity({
      userId,
      action: "first_admin_created",
      details: { username },
      ip,
      userAgent,
      module: "auth",
    });
    await this.securityRepo.logSecurityEvent({
      userId,
      eventType: "first_admin_created",
      severity: "info",
      details: { username },
      ip,
      userAgent,
    });

    const { password: _omit, ...safeUser } = newUser as Record<string, unknown>;
    void _omit;
    return safeUser as SanitizedFirstAdmin;
  }
}
