import { logger } from "./logger";

/**
 * فحص حيوية حقل `genres` في قوائم عناصر الوسائط عبر طبقات الباكند.
 *
 * الهدف: تشخيص أي طبقة تفقد التصنيفات (genres) أثناء سير البيانات
 * Repository → Service → API. تُستدعى في طبقة الخدمة بعد معالجة القوائم
 * (`processMediaItem`) فتقيس صحة الحقل في المخرجات؛ أي انخفاض في `present`
 * أو ظهور `malformed` يشير إلى أن الخلل في طبقة الاستعلام/المعالجة، بينما
 * سلامة الحقل هنا تعني أن الخلل محصور في الواجهة (mapper/card).
 *
 * هذه وحدة تطوير فقط: كل الدوال لا تفعل شيئاً عندما يكون اللوجر معطّلاً
 * (`logger.enabled === false`) — لا أثر في الإنتاج.
 */

/**
 * إحصاء صحة حقل `genres` في قائمة عناصر وسائط.
 */
export interface GenresHealth {
  /** إجمالي عدد العناصر المفحوصة. */
  total: number;
  /** عدد العناصر التي يحمل `genres` فيها قيمة صالحة (نص JSON قابل للتحليل أو مصفوفة). */
  present: number;
  /** عدد العناصر التي لا يحتوي `genres` فيها على أي قيمة (undefined/null). */
  missing: number;
  /** عدد العناصر التي يملك `genres` لكنه فارغ أو غير مصفوفة بعد التحليل. */
  empty: number;
  /** عدد العناصر التي يحمل `genres` نصاً لا يمكن تحليله (JSON.parse يرمي خطأ). */
  malformed: number;
}

/**
 * يحسب إحصاء صحة حقل `genres` لقائمة عناصر وسائط.
 *
 * @param items - عناصر الوسائط (كائنات) كما تخرج من طبقة الاستعلام أو المعالجة.
 * @returns إحصاء يوزّع العناصر على: present / missing / empty / malformed.
 */
export function genresHealth(items: readonly Record<string, unknown>[]): GenresHealth {
  let present = 0;
  let missing = 0;
  let empty = 0;
  let malformed = 0;
  for (const item of items) {
    const raw = item["genres"];
    if (raw === undefined || raw === null) {
      missing++;
      continue;
    }
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        present++;
      } else {
        empty++;
      }
    } catch {
      malformed++;
    }
  }
  return { total: items.length, present, missing, empty, malformed };
}

/**
 * يسجّل سطر تتبّع منسّقاً (debug) عن صحة حقل `genres` لقائمة عناصر في طبقة معينة.
 *
 * لا يُنفَّذ أي عمل عند تعطيل اللوجر (`logger.enabled === false`) — فلا أثر على
 * مسار الأداء في الإنتاج. يظهر السطر عند تشغيل المطوّر بالأوامر:
 * `DEV_CONSOLE=1 DEV_CONSOLE_LEVEL=debug`، ويكون الحدث `media.genres.trace`.
 *
 * @param source - وسم الطبقة/الأسلوب، مثال `service:getLatestItems`.
 * @param items - عناصر الوسائط بعد معالجتها في الطبقة المطلوبة.
 */
export function traceGenresHealth(source: string, items: readonly Record<string, unknown>[]): void {
  if (!logger.enabled) return;
  const health = genresHealth(items);
  logger.debug("media.genres.trace", {
    source,
    total: health.total,
    present: health.present,
    missing: health.missing,
    empty: health.empty,
    malformed: health.malformed,
  });
}
