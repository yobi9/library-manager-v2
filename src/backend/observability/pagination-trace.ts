import { logger, type LogFields, type LogLevel } from "./logger";

/**
 * كاشف انحراف لقطة الترقيم (Offset Snapshot Skew) — وحدة مراقبة تطويرية.
 *
 * الهدف: التقاط فئة الفشل الصامتة التي لا تنتج أي خطأ فردي: عندما تُجلب
 * صفحة أولى (offset=0) في لحظة ما ثم تُجلب صفحات لاحقة لنفس القائمة بعد أن
 * تغيّر مجموع السجلّات (إدراج/حذف أثناء مسح مثلاً)، تكون كل استجابة صحيحة
 * منفردةً لكن اتحاد الصفحات يحوي تكراراً أو فجوة لأن نافذة OFFSET انزاحت.
 *
 * الآلية: تحفظ الوحدة «مرساة إجمالي» لكل قائمة (مكتبة × بصمة فلترة) عند
 * طلب `offset=0`، وتقارن إجمالي كل صفحة لاحقة (`offset>0`) بالمرساة داخل
 * نافذة زمنية. أي اختلاف يُصدر تحذيراً منظماً `pagination.snapshot_skew`.
 *
 * هذه وحدة تطوير فقط: كل الدوال لا تفعل شيئاً عندما يكون اللوجر معطّلاً
 * (`logger.enabled === false`) — لا حالة دائمة ذات معنى ولا أثر في الإنتاج.
 */

/**
 * النافذة الزمنية (بالملي ثانية) لاعتبار مرساة الإجمالي صالحة للمقارنة.
 *
 * @remarks القيمة 5 دقائق مختارة لتغطية جلسات تصفّح طويلة فوق مدة
 *          `MEDIA_LIST_CACHE_TTL_SECONDS` (60ث) في `media-service.ts`،
 *          بحيث تشمل الانحرافات الناتجة عن كاش منتهٍ حديثاً وليس فقط الحي.
 */
const PAGINATION_SKEW_WINDOW_MS = 5 * 60 * 1000;

/** السقف الأعلى لعدد المراسيات المحفوظة قبل التنظيف الكسول للمنتهية منها. */
const PAGINATION_ANCHORS_MAX = 200;

/**
 * حقول قائمة وسائط المشاركة في هوية القائمة لأغراض التتبع.
 *
 * @remarks هذه الحقول هي نفسها معاملات `getLibraryMedia` عدا `offset`
 *          و`limit` المتعمّد استثناؤهما: حجم الصفحة أو موضعها لا يغيّران
 *          هوية القائمة، بينما أي فلتر آخر يفصل بين قائمتين مختلفتين.
 */
export interface MediaListTraceOptions {
  rootOnly?: boolean;
  sortBy?: string;
  sortOrder?: string;
  year?: string;
  genre?: string;
  certification?: string;
  search?: string;
}

/** مشاهدة واحدة لصفحة مُخدَمة من قائمة وسائط. */
export interface PageObservation {
  /** معرف المكتبة صاحبة القائمة. */
  libraryId: number;
  /** بصمة الفلترة (من {@link buildMediaListScope}) بدون offset/limit. */
  scope: string;
  /** إزاحة الصفحة المطلوبة. */
  offset: number;
  /** الإجمالي المُبلَّغ عنه في استجابة هذه الصفحة. */
  total: number;
  /** عدد العناصر الفعلي في صفحة هذه الاستجابة. */
  count: number;
  /** معرّف أول عنصر في الصفحة (أو null إذا كانت الصفحة فارغة). */
  firstId: number | null;
  /** معرّف آخر عنصر في الصفحة (أو null إذا كانت الصفحة فارغة). */
  lastId: number | null;
}

/** مرساة إجمالي مسجَّلة لقائمة واحدة. */
interface PaginationAnchor {
  /** إجمالي القائمة لحظة تسجيل المرساة (صفحة offset=0). */
  total: number;
  /** طابع زمني للتسجيل (بالملي ثانية) عبر مصدر الوقت المحقون. */
  seenAt: number;
}

/**
 * يبني بصمة هوية القائمة من معاملات الفلترة (بدون offset/limit).
 *
 * @param options - معاملات قائمة الوسائط كما وردت لطبقة الخدمة.
 * @param blockedCertificationsCount - عدد التصنيفات المحظورة المطبقة
 *        (تؤثر على الإجمالي فعلياً، لذا تدخل البصمة).
 * @returns نص بصمة مستقر الترتيب يُستخدم مفتاح مرساة في المتتبع.
 */
export function buildMediaListScope(
  options: MediaListTraceOptions,
  blockedCertificationsCount: number,
): string {
  return [
    String(options.rootOnly ?? ""),
    options.sortBy ?? "",
    options.sortOrder ?? "",
    options.year ?? "",
    options.genre ?? "",
    options.certification ?? "",
    options.search ?? "",
    String(blockedCertificationsCount),
  ].join("|");
}

/**
 * متتبع انحراف لقطة الترقيم: يسجل مراسي الإجمالي ويكشف اختلافها لاحقاً.
 *
 * @remarks قابلية الاختبار: يمكن حقن مصدر وقت ومصدر إصدار للأحداث عبر
 *          المُنشئ؛ الافتراضي يستخدم `Date.now` واللوجر المنظم مباشرة.
 *          بعد كل تحذير تُحدَّث المرساة للإجمالي الجديد حتى لا تتكرر
 *          الإنذارات عن نفس التغيّر مع كل صفحة أثناء مسح متواصل.
 */
export class PaginationSkewTracker {
  private readonly anchors = new Map<string, PaginationAnchor>();
  private readonly now: () => number;
  private readonly emit: (level: LogLevel, event: string, fields: LogFields) => void;
  /** بوابة التفعيل: اللوجر فقط للمسار الافتراضي؛ المصدر المحقون يعمل دائماً. */
  private readonly gated: boolean;

  /**
   * ينشئ المتتبع بمصادر حقن اختيارية للاختبار.
   *
   * @param deps - `now` مصدر الوقت (افتراضياً `Date.now`)، و`emit` مصدر
   *        إصدار الأحداث (افتراضياً اللوجر المنظم). عند حقن `emit` تُلغى
   *        بوابة `logger.enabled` لأن الحقن موجود تحديداً لتجاوز بيئة
   *        الإنتاج في الاختبارات.
   */
  constructor(deps: {
    now?: () => number;
    emit?: (level: LogLevel, event: string, fields: LogFields) => void;
  } = {}) {
    this.now = deps.now ?? Date.now;
    this.emit =
      deps.emit ??
      ((level, event, fields) => logger.log(level, event, fields));
    this.gated = deps.emit === undefined;
  }

  /**
   * يعالج مشاهدة صفحة مخدومة: يسجّل حدث `media.page_served` دائماً،
   * ويحدّث المرساة عند `offset=0`، ويقارن بالإرساة عند `offset>0`.
   *
   * @param obs - مشاهدة الصفحة (معرف المكتبة، البصمة، الإزاحة، الإجمالي…).
   * @returns لا شيء؛ الأثر جانبي فقط (سجلات منظمة + حالة المراسيات).
   */
  observePage(obs: PageObservation): void {
    if (this.gated && !logger.enabled) return;

    this.pruneExpired();

    this.emit("debug", "media.page_served", {
      libraryId: obs.libraryId,
      scope: obs.scope,
      offset: obs.offset,
      total: obs.total,
      count: obs.count,
      firstId: obs.firstId,
      lastId: obs.lastId,
    });

    const key = `${obs.libraryId}::${obs.scope}`;
    const timestamp = this.now();

    if (obs.offset === 0) {
      this.anchors.set(key, { total: obs.total, seenAt: timestamp });
      return;
    }

    const anchor = this.anchors.get(key);
    if (!anchor) return;

    if (timestamp - anchor.seenAt > PAGINATION_SKEW_WINDOW_MS) {
      this.anchors.delete(key);
      return;
    }

    if (anchor.total !== obs.total) {
      this.emit("warn", "pagination.snapshot_skew", {
        libraryId: obs.libraryId,
        scope: obs.scope,
        offset: obs.offset,
        expectedTotal: anchor.total,
        actualTotal: obs.total,
        shift: obs.total - anchor.total,
        anchorAgeMs: timestamp - anchor.seenAt,
      });
      // تحديث المرساة بعد الإنذار: تغيّر واحد = إنذار واحد.
      this.anchors.set(key, { total: obs.total, seenAt: timestamp });
      return;
    }

    // لمسة حياة للمرساة الصالحة حتى لا تنتهي صلاحيتها وسط جلسة نشطة.
    anchor.seenAt = timestamp;
  }

  /**
   * ينظف كسولاً المراسيات المنتهية صلاحيتها عند تجاوز السقف.
   *
   * @remarks يُستدعى ضمن `observePage`؛ يحمي من نمو غير محدود في جلسات
   *          طويلة متعددة الفلاتر دون جدولة خلفية أو مؤقتات.
   */
  pruneExpired(): void {
    if (this.anchors.size <= PAGINATION_ANCHORS_MAX) return;
    const timestamp = this.now();
    for (const [key, anchor] of this.anchors) {
      if (timestamp - anchor.seenAt > PAGINATION_SKEW_WINDOW_MS) {
        this.anchors.delete(key);
      }
    }
  }
}

/** النسخة الوحيدة من المتتبع لعملية الخدمة (نمط singleton كسول). */
let paginationSkewTracker: PaginationSkewTracker | null = null;

/**
 * يرجع النسخة الوحيدة من {@link PaginationSkewTracker} منشئاً عند أول نداء.
 *
 * @returns المتتبع المشترك الذي تستخدمه طبقة الخدمة لجميع قوائم الوسائط.
 */
export function getPaginationSkewTracker(): PaginationSkewTracker {
  paginationSkewTracker ??= new PaginationSkewTracker();
  return paginationSkewTracker;
}
