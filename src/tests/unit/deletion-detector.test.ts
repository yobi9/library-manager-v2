/**
 * اختبارات وحدة لكاشف الحذف (`DeletionDetector`) بعد إعادة الكتابة على العمود
 * المفهرس.
 *
 * الغاية: تأمين "عقد العمل" في `deletion-detector.ts` — الدوال النقية التي
 * تُبنى منها جملة SQL هي كل المنطق القابل للاختبار خارج قاعدة البيانات:
 *   1) `normalizeStoragePath` تحويل الجذور إلى صيغة التخزين الفعلية (باكسلاش
 *      وأحرف صغيرة) حتى يطابق `LIKE` العمود المفهرس مباشرة.
 *   2) `escapeLikePattern` حرفيّ `%` / `_` داخل أسماء المجلدات (مثل `50% off`)
 *      لا تُعامل كـ wildcards.
 *   3) `buildPathPrefixConditions` صياغة `NOT LIKE ... ESCAPE '\'` (مكافئ
 *      De Morgan لـ "تحت أي جذر") بعدد/ترتيب الأنماط المطابق للجذور.
 *   4) `normalizeDeletionRoots` إزالة التكرار والقيم الفارغة.
 *
 * ملاحظات التنفيذ:
 * - لا نمسّس `getDatabase()` هنا — بيئة الاختبار `node` فقط والاختبارات التي
 *   تلامس قاعدة البيانات محفوظة لـ `src/tests/integration/`.
 * - السيناريوهات تختبر الجذور بمسارات ويندوز حقيقية (بما فيها UNC
 *   `\\server\share`) لأن تحويلها الصحيح هو ما يحمي من تعليم عناصر المكتبات
 *   المتصلة عبر مشاركات الشبكة كـ "محذوفة".
 */
import { describe, expect, it } from "vitest";
import {
  escapeLikePattern,
  buildPathPrefixConditions,
  normalizeDeletionRoots,
} from "@/backend/scanner/deletion-detector";
import { normalizeStoragePath } from "@/backend/repositories/base-repository";

describe("normalizeStoragePath", () => {
  it("يحوّل الشرطات الأمامية لباكسلاش والأحرف لصيغة صغيرة", () => {
    expect(normalizeStoragePath("C:/Movies/Inception")).toBe("c:\\movies\\inception");
  });

  it("يزيل الشرطة الباكسلاش الزائدة في النهاية", () => {
    expect(normalizeStoragePath("D:\\Series\\")).toBe("d:\\series");
  });

  it("يحافظ على مسارات UNC بـ \\\\", () => {
    expect(normalizeStoragePath("//server/share/Movies")).toBe("\\\\server\\share\\movies");
    expect(normalizeStoragePath("\\\\server\\share\\Movies")).toBe("\\\\server\\share\\movies");
  });

  it("يعيد توجيه الباكسلاش المفردة البادئة إلى شكل مزدوج", () => {
    expect(normalizeStoragePath("\\relative")).toBe("\\\\relative");
  });

  it("يرجع سلسلة فارغة للمدخل الفارغ", () => {
    expect(normalizeStoragePath("")).toBe("");
    expect(normalizeStoragePath(undefined as unknown as string)).toBe("");
  });
});

describe("escapeLikePattern", () => {
  it("يضاعف الباكسلاش ويبقي الشرطات النافذة بدون تغيير", () => {
    expect(escapeLikePattern("c:\\movies\\inception")).toBe("c:\\\\movies\\\\inception");
  });

  it("يهرب `%` و `_` لأنهما wildcards في LIKE", () => {
    expect(escapeLikePattern("c:\\50% off\\_new")).toBe("c:\\\\50\\% off\\\\\\_new");
  });

  it("لا يغيّر المسار الخالي", () => {
    expect(escapeLikePattern("")).toBe("");
  });
});

describe("buildPathPrefixConditions", () => {
  it("يبني شرط NOT LIKE واحد ببادئة % لكل جذر على العمود المعطى", () => {
    const { clause, patterns } = buildPathPrefixConditions("directory_path", ["c:\\movies"]);
    expect(clause).toBe("directory_path NOT LIKE ? ESCAPE '\\'");
    expect(patterns).toEqual(["c:\\\\movies%"]);
  });

  it("يربط عدة جذور بـ AND ويحافظ على الترتيب مع أنماطها", () => {
    const roots = ["d:\\series", "e:\\anime"];
    const { clause, patterns } = buildPathPrefixConditions("file_path", roots);
    expect(clause).toBe("file_path NOT LIKE ? ESCAPE '\\' AND file_path NOT LIKE ? ESCAPE '\\'");
    expect(patterns).toEqual(["d:\\\\series%", "e:\\\\anime%"]);
  });

  it("يبني شرطاً فارغاً لقائمة جذور خالية", () => {
    const { clause, patterns } = buildPathPrefixConditions("directory_path", []);
    expect(clause).toBe("");
    expect(patterns).toEqual([]);
  });
});

describe("normalizeDeletionRoots", () => {
  it("يطبّع الجذور لصيغة التخزين ويزيل التكرار", () => {
    expect(normalizeDeletionRoots(["C:/Movies", "c:\\Movies", "D:/Series/"])).toEqual([
      "c:\\movies",
      "d:\\series",
    ]);
  });

  it("يتجاهل القيم الفارغة", () => {
    expect(normalizeDeletionRoots(["", "   ", "C:/Movies"])).toEqual(["c:\\movies"]);
  });

  it("يرجع قائمة فارغة عندما لا توجد جذور صالحة", () => {
    expect(normalizeDeletionRoots([])).toEqual([]);
    expect(normalizeDeletionRoots(["", "  "])).toEqual([]);
  });
});
