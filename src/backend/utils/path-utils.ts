import fs from "node:fs/promises";
import { logger } from "../observability/logger";

/**
 * يكتشف ما إذا كان المسار المخزَّن مسار قرص مطلقاً حقيقياً (محرك + فاصل، أو
 * مشاركة شبكة UNC) وليس مساراً web-relative يبدأ بـ `/` — ففي Node على ويندوز
 * `path.isAbsolute("/assets/...")` يُرجع `true` لأنه يعامله كمستوٍ على جذر
 * المحرك، لذا لا يصح الاعتماد عليه لتمييز مسارات القرص من المسارات الويب.
 *
 * - المصدر الموثوق: كان يعيش خاصاً داخل `ImageService` ثم نُقل إلى هذا الملف
 *   المشترك لأنه مطلوب أيضاً في `TmdbEnrichmentService` (كتابة صور الإثراء)
 *   لضمان تطابق مسار الكتابة مع مسار القراءة في `resolveImagePath`.
 * - النطاق: أي مسار صورة مخزَّن في القاعدة أو مسار تخزين قادم من الإعدادات.
 *
 * @param storedPath - المسار المراد فحصه (مثل `D:\assets\images\enriched` أو `/assets/images/enriched`).
 * @returns `true` عندما يكون المسار مطلقاً على القرص (`C:\...` / `\\server\...`).
 */
export function isAbsoluteDiskPath(storedPath: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(storedPath) || /^[\\/]{2}/.test(storedPath);
}

/**
 * ينشئ قائمة مجلدات على القرص (بما فيها المجلدات الفرعية) بـ `recursive: true`
 * ويسجّل نجاح العملية في سجل المراقبة البنيوي.
 *
 * - الغرض: نمط موحّد لضمان وجود مجلدات النظام (النسخ الاحتياطية، التراخيص،
 *   صور الإثراء، الصور المرفوعة) عند بدء التشغيل وعند تغيير إعداد المسار،
 *   دون تكرار منطق `fs.mkdir` والتسجيل في كل خدمة.
 * - السلوك: لا يُمسح أي مجلد موجود؛ العملية idempotent وآمنة للتكرار.
 * - الفشل: الدالة ترمي الخطأ لأعلى — على المستدعي التقاطه وتسجيله دون
 *   إيقاف تشغيل الخدمة/التطبيق (متطلب «عدم التعطيل»).
 *
 * @param dirs - قائمة المسارات المراد ضمان وجودها (تُنشأ بالتسلسل).
 * @param component - اسم المكوّن الطالب (مثل `ImageService`) لرسالة السجل.
 * @throws عندما يتعذّر إنشاء أي مجلد من القائمة (خطأ نظام ملفات).
 */
export async function ensureDirs(dirs: readonly string[], component: string): Promise<void> {
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  logger.info("dirs.ensured", { component, dirs: [...dirs] });
}
