/**
 * اختبارات وحدة أدوات تطبيع البحث الصوتي العربي لخدمة FTS5.
 *
 * الغاية: تأمين سلوك `normalizeQuery`, `getArabicPhoneticKey`, `buildFTSQuery`
 * المستهلكة في `SearchService` و`MediaService`؛ أي تغيير مستقبلي في التطبيع
 * يجب ألا يكسر فولباك البحث الصوتي أو استعلامات البادئة.
 */
import { describe, expect, it } from "vitest";
import {
  buildFTSQuery,
  getArabicPhoneticKey,
  normalizeQuery,
} from "@/backend/utils/search-normalizer";

describe("normalizeQuery", () => {
  it("يعيد سلسلة فارغة للمدخل الفارغ", () => {
    expect(normalizeQuery("")).toBe("");
    expect(normalizeQuery("   ")).toBe("");
  });

  it("يوحّد أشكال الألف والمقصورة والتاء المربوطة", () => {
    expect(normalizeQuery("أحمد إبراهيم")).toBe("احمد ابراهيم");
    expect(normalizeQuery("على")).toBe("علي");
    expect(normalizeQuery("فاطمة")).toBe("فاطمه");
  });

  it("يزيل التشكيل العربي واللاتيني", () => {
    expect(normalizeQuery("مُحَمَّد")).toBe("محمد");
    expect(normalizeQuery("café")).toBe("cafe");
  });

  it("يحوّل لأحرف صغيرة ويقصّ الفراغات ويضغط الفراغات المتعددة", () => {
    expect(normalizeQuery("  Hello   WORLD  ")).toBe("hello world");
  });

  it("يحوّل الرموز اللاتينية غير الأبجدية إلى فراغ ويضغط الفراغات", () => {
    expect(normalizeQuery("hello, world!")).toBe("hello world");
  });

  it("يحافظ على الكتلة العربية كاملة (سلوك قائم: يشمل ؟ لكونها ضمن U+0600–U+06FF)", () => {
    expect(normalizeQuery("الكتاب؟")).toBe("الكتاب؟");
  });
});

describe("getArabicPhoneticKey", () => {
  it("يعيد سلسلة فارغة للمدخل الفارغ", () => {
    expect(getArabicPhoneticKey("")).toBe("");
  });

  it("يجمع الحروف المتقاربة صوتياً في رمز واحد ويزيل التكرار المتتالي", () => {
    expect(getArabicPhoneticKey("أحمد")).toBe("AMT");
    expect(getArabicPhoneticKey("احمد")).toBe("AMT");
  });

  it("يحوّل الأحرف اللاتينية إلى كبيرة ويتركها كما هي", () => {
    expect(getArabicPhoneticKey("test")).toBe("TEST");
  });

  it("يطبّع المدخل قبل التحويل الصوتي", () => {
    expect(getArabicPhoneticKey("على")).toBe("ALY");
  });

  it("يقصّ الناتج إلى 32 حرفاً كحد أقصى", () => {
    const key = getArabicPhoneticKey("محمد علي خالد ناصر فؤاد حسن طارق يوسف وليد سامي");
    expect(key.length).toBeLessThanOrEqual(32);
  });
});

describe("buildFTSQuery", () => {
  it("يعيد سلسلة فارغة عندما لا توجد كلمات", () => {
    expect(buildFTSQuery("")).toBe("");
    expect(buildFTSQuery("   ")).toBe("");
  });

  it("يبني استعلام بادئة AND لكل كلمة", () => {
    expect(buildFTSQuery("أحمد علي")).toBe("احمد* AND علي*");
  });

  it("يطبّع الكلمات قبل بناء الاستعلام", () => {
    expect(buildFTSQuery("فاطمة,")).toBe("فاطمه*");
  });
});
