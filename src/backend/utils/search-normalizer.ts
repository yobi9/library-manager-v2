/**
 * أدوات تطبيع النصوص والبحث الصوتي العربي لخدمة FTS5.
 *
 * - المصدر الموثوق: هذا الملف هو المصدر الوحيد لمنطق تطبيع الاستعلامات
 *   والتحويل الصوتي؛ يستهلكه `SearchService` و`MediaService` (بحث الأشخاص).
 * - النطاق: تطبيع عربي/لاتيني موحّد + مفتاح صوتي عربي (phonetic) لفولباك
 *   البحث عند فشل المطابقة الصوتية في FTS5.
 * - القيود: الـ phonetic مخصص للأسماء العربية الشائعة ولا يغطي كل اللهجات؛
 *   الطول مقصوص إلى 32 حرفاً حفاظاً على حجم الفهرس.
 */

/**
 * مجموعة النطق الصوتي العربي (الحروف المتقاربة صوتياً تُجمَّع في رمز واحد).
 *
 * المجموعات مأخوذة من سلوك المشروع القديم `SearchNormalizer.getArabicPhoneticKey`
 * (مرجع سلوكي فقط) وتُستخدم لبناء مفتاح يسمح بالمطابقة رغم اختلاف الهجاء
 * (مثل: "أحمد" و"احمد" و"حمد" تتقارب في رمز `AHMD`).
 */
const PHONETIC_GROUPS: Record<string, string> = {
  ء: "A",
  أ: "A",
  إ: "A",
  آ: "A",
  ؤ: "A",
  ئ: "A",
  ع: "A",
  ح: "A",
  ه: "A",
  ت: "T",
  ط: "T",
  د: "T",
  ث: "S",
  س: "S",
  ص: "S",
  ز: "Z",
  ذ: "Z",
  ظ: "Z",
  ج: "J",
  ش: "SH",
  ي: "Y",
  ك: "K",
  ق: "K",
  ل: "L",
  م: "M",
  ن: "N",
  ر: "R",
  ف: "F",
  ب: "B",
  و: "W",
  خ: "KH",
  غ: "GH",
};

/**
 * يطبّق سلسلة تطبيع على نص (عربي ولاتيني) لمطابقة فهرس FTS5.
 *
 * خطوات المعالجة:
 *   1. تحويل إلى أحرف صغيرة وقصّ الفراغات
 *   2. فك التركيب Unicode (NFD) وإزالة العلامات اللاتينية (café → cafe)
 *   3. إزالة التشكيل العربي (المدى 064B–065F)
 *   4. توحيد ألف (أإآ → ا) وألف مقصورة (ى → ي) وتاء مربوطة (ة → ه)
 *   5. إزالة الرموز غير الأبجدية الرقمية مع إبقاء الكتلة العربية
 *   6. ضغط الفراغات المتعددة
 *
 * @param query - نص الاستعلام الخام من المستخدم.
 * @returns الاستعلام المطبَّع، أو سلسلة فارغة إذا كان المدخل فارغاً.
 */
export function normalizeQuery(query: string): string {
  if (!query) return "";
  return query
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[^\w\s\u0600-\u06FF]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * يبني مفتاحاً صوتياً عربياً (phonetic) من نص للسماح بالمطابقة رغم أخطاء الهجاء.
 *
 * - المنطق: يحوّل كل حرف عربي إلى رمزه الصوتي حسب `PHONETIC_GROUPS`، يدمج
 *   الأحرف اللاتينية بحروف كبيرة، يزيل التكرار المتتالي، ويقصّ الطول إلى 32.
 * - الاستخدام: يُحفظ في عمود `media_search.phonetic_key` أثناء بناء الفهرس،
 *   وتُستعلم عنه كفولباك عندما يقل عدد نتائج FTS5 عن الحد الأدنى.
 *
 * @param text - النص المراد تحويله (عادة عنوان + أنوع + طاقم).
 * @returns المفتاح الصوتي بحروف كبيرة، أو سلسلة فارغة إذا كان المدخل فارغاً.
 */
export function getArabicPhoneticKey(text: string): string {
  if (!text) return "";
  const str = normalizeQuery(text);

  let result = "";
  for (const ch of str) {
    if (PHONETIC_GROUPS[ch]) result += PHONETIC_GROUPS[ch];
    else if (/[a-zA-Z]/.test(ch)) result += ch.toUpperCase();
  }
  result = result.replace(/(.)\1+/g, "$1");
  return result.substring(0, 32);
}

/**
 * يبني استعلام FTS5 من نص مكسور إلى كلمات مع بادئة (`word*`).
 *
 * - المنطق: كل كلمة تصبح `word*` (مطابقة بادئة) وتُربط بـ `AND` لضمان أن
 *   جميع الكلمات تظهر في النتائج.
 *
 * @param query - نص الاستعلام الخام.
 * @returns استعلام FTS5 جاهز لـ `MATCH`، أو سلسلة فارغة إذا لم توجد كلمات.
 */
export function buildFTSQuery(query: string): string {
  const normalized = normalizeQuery(query);
  if (!normalized) return "";
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "";
  return words.map((w) => `${w}*`).join(" AND ");
}
