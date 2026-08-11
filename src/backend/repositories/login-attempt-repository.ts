import { BaseRepository } from "./base-repository";

/**
 * سجلّ محاولات تسجيل الدخول الفاشلة في جدول `login_attempts`.
 *
 * يعرّف الجدول:
 * - `username` — المفتاح الأساسي: اسم المستخدم المتعثر.
 * - `attempt_count` — عدد المحاولات الفاشلة المتتالية.
 * - `locked_at` — الطابع الزمني (ملي ثانية) لآخر فشل؛ يُقارن مع نافذة القفل.
 * - `last_failed_at` — الطابع الزمني لآخر فشل (احتياطي/تحليلي).
 *
 * الغرض: إبقاء عداد القفل صامداً عبر إعادة تشغيل السيرفر ومشتركاً بين عمليات
 * متعددة بدلاً من خريطة الذاكرة القديمة في `auth-service`.
 */
export interface LoginAttemptRow {
  username: string;
  attempt_count: number;
  locked_at: number;
  last_failed_at: number;
}

export class LoginAttemptRepository extends BaseRepository {
  constructor() {
    super("login_attempts");
  }

  /**
   * يقرأ صف المحاولات لاسم مستخدم محدد.
   *
   * @param username - اسم المستخدم المستعلم عنه.
   * @returns الصف الحالي أو `undefined` عند غيابه (لا محاولات مسجلة).
   */
  async get(username: string): Promise<LoginAttemptRow | undefined> {
    return (await this.queryOne("SELECT * FROM login_attempts WHERE username = ?", [username])) as
      LoginAttemptRow | undefined;
  }

  /**
   * يزيد عدّاد المحاولات الفاشلة لاسم مستخدم (إنشاء أو تحديث Upsert) ويعيد
   * تعيين `locked_at` للطابع الحالي — بنفس دلالة الدالة القديمة
   * `recordFailedAttempt`.
   *
   * @param username - اسم المستخدم الذي فشلت محاولته.
   * @param now - طابع زمني (ملي ثانية) اختياري؛ الافتراضي `Date.now()`.
   */
  async increment(username: string, now = Date.now()): Promise<void> {
    await this.execute(
      `INSERT INTO login_attempts (username, attempt_count, locked_at, last_failed_at, updated_at)
       VALUES (?, 1, ?, ?, datetime('now'))
       ON CONFLICT(username) DO UPDATE SET
         attempt_count = attempt_count + 1,
         locked_at = excluded.locked_at,
         last_failed_at = excluded.last_failed_at,
         updated_at = datetime('now')`,
      [username, now, now],
    );
  }

  /**
   * يحذف صف المحاولات بعد نجاح تسجيل الدخول (تصفير العداد).
   *
   * @param username - اسم المستخدم الذي سجّل دخوله بنجاح.
   */
  async clear(username: string): Promise<void> {
    await this.execute("DELETE FROM login_attempts WHERE username = ?", [username]);
  }

  /**
   * يحذف الصفوف المنتهية نافذة قفلها (تنظيف دوري لمنع نمو الجدول بلا حدود).
   *
   * @param beforeTimestampMs - الصفوف الأقدم من هذا الطابع (ملي ثانية) تُحذف.
   */
  async deleteExpired(beforeTimestampMs: number): Promise<void> {
    await this.execute("DELETE FROM login_attempts WHERE locked_at < ?", [beforeTimestampMs]);
  }
}
