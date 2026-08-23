/**
 * خدمة سياسة الوصول للمحتوى — Phase 1: Global Blocklist فقط.
 *
 * الغرض: تحديد ما إذا كان محتوى معين يجب حظره بناءً على تصنيفه العمرية.
 *
 * @remarks
 * - Admin يرى كل شيء دائماً (bypass كامل)
 * - المحتوى بدون تصنيف (null/empty) مسموح دائماً
 * - لا يوجد per-user في هذه المرحلة
 * - هذه الخدمة وظيفة نقية (pure functions) — لا حالة، لا DB، لا cache
 *
 * مصدر الحقيقة: قرار المستخدم (2026-08-20)
 */

import type { AuthContext } from "../api/route-helpers";

/**
 * نتيجة تحليل سياسة الحظر للمحتوى.
 *
 * @remarks
 * تمثل حالة الفلترة للمستخدم الحالي. إذا كانت `enabled` false، يجب تخطي الفلترة.
 */
export interface ContentFilter {
  /** هل الفلترة مفعّلة لهذا المستخدم؟ */
  enabled: boolean;
  /** قائمة التصنيفات المحظورة (فارغة إذا غير مفعّل). */
  blockedCertifications: string[];
}

/**
 * تحديد قائمة التصنيفات المحظورة بناءً على حالة المستخدم والإعدادات.
 *
 * @remarks
 * القاعدة:
 * - Admin bypass → enabled: false
 * - parental_control_enabled = false → enabled: false
 * - غير ذلك → enabled: true + blocked_certifications من الإعدادات
 *
 * @param auth - سياق المصادقة (null للزائر غير المسجّل).
 * @param settings - إعدادات النظام من قاعدة البيانات.
 * @returns ContentFilter يحدد ما إذا كانت الفلترة مفعّلة والتصنيفات المحظورة.
 */
export function resolveBlockedCertifications(
  auth: AuthContext | null,
  settings: Record<string, unknown>,
): ContentFilter {
  if (auth?.isAdmin) {
    return { enabled: false, blockedCertifications: [] };
  }
  if (!settings["parental_control_enabled"]) {
    return { enabled: false, blockedCertifications: [] };
  }
  const blocked = settings["blocked_certifications"];
  return {
    enabled: true,
    blockedCertifications: Array.isArray(blocked) ? (blocked as string[]) : [],
  };
}

/**
 * التحقق من ما إذا كان عنصر معين يجب حظره بناءً على تصنيفه.
 *
 * @remarks
 * - إذا كانت الفلترة غير مفعّلة → false (لا حظر)
 * - المحتوى بدون تصنيف (null/undefined/empty) → false (مسموح دائماً)
 * - التصنيف موجود في القائمة المحظورة → true (يُحظر)
 * - غير ذلك → false (مسموح)
 *
 * @param certification - التصنيف العمرية للعنصر (قد يكون null/undefined).
 * @param filter - نتيجة تحليل السياسة من {@link resolveBlockedCertifications}.
 * @returns true إذا كان العنصر يجب حظره، false إذا مسموح.
 */
export function shouldBlockMedia(
  certification: string | null | undefined,
  filter: ContentFilter,
): boolean {
  if (!filter.enabled) return false;
  if (!certification || certification.trim() === "") return false;
  return filter.blockedCertifications.includes(certification);
}

/**
 * بناء شرط SQL لاستبعاد التصنيفات المحظورة من استعلامات media_items.
 *
 * @remarks
 * يُنشئ شرط WHERE يضمن:
 * - العناصر ذات التصنيف غير المحظور تظهر
 * - العناصر بدون تصنيف (NULL أو فارغ) تظهر دائماً
 * - العناصر ذات التصنيف المحظور لا تظهر
 *
 * @example
 * ```ts
 * const filter = { enabled: true, blockedCertifications: ["R", "NC-17"] };
 * const sql = buildCertificationSqlFilter(filter);
 * // sql.clause = "(m.certification NOT IN (?,?) OR m.certification IS NULL OR m.certification = '')"
 * // sql.values = ["R", "NC-17"]
 * ```
 *
 * @param filter - نتيجة تحليل السياسة.
 * @returns كائن يحتوي على شرط SQL + القيم المُمرَّرة، أو null إذا لا فلترة مطلوبة.
 */
export function buildCertificationSqlFilter(
  filter: ContentFilter,
): { clause: string; values: string[] } | null {
  if (!filter.enabled || filter.blockedCertifications.length === 0) return null;
  const placeholders = filter.blockedCertifications.map(() => "?").join(",");
  return {
    clause: `(m.certification NOT IN (${placeholders}) OR m.certification IS NULL OR m.certification = '')`,
    values: filter.blockedCertifications,
  };
}
