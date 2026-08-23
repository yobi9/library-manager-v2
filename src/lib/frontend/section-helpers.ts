import { ROUTES } from "@/shared/constants";
import type { Library } from "./api-media";
/**
 * يبني رابط التنقل الخاص ببطاقة القسم.
 *
 * - الحاوية الرئيسية (`main`): صفحة الأقسام الداخلية.
 * - الاختصار (`linked`): يفتح صفحة القسم المستهدف مباشرة (حسب `linked_library_id`).
 * - أي قسم محتوى عادي: صفحة عناصره.
 *
 * @param section - كائن المكتبة (Library) المراد بناء رابطها.
 * @returns مسار الرابط النسبي.
 */
/**
 * يبني رابط التنقل الخاص ببطاقة القسم.
 */
export function buildSectionLink(section: Library): string {
  if (section.type === "main") return `${ROUTES.SECTIONS}/${section.library_id}`;
  const targetId = section.linked_library_id ?? section.linkedLibraryId;
  if (section.type === "linked" && targetId) return `${ROUTES.ITEMS}/${targetId}`;
  return `${ROUTES.ITEMS}/${section.library_id}`;
}
/**
 * يحلّ مسار صورة المكتبة من سجلها بترتيب أولوية: `image` ثم `image_path`.
 *
 * @param section - كائن المكتبة (Library) المراد استخراج صورة له.
 * @returns مسار صورة ويبي، أو `null` إن لم يوجد أي مسار مسجّل.
 */
/**
 * يحلّ مسار صورة المكتبة من سجلها بترتيب أولوية: `image` ثم `image_path`.
 */
export function getSectionImageUrl(section: Library): string | null {
  if (section.image) return section.image;
  if (section.image_path) return section.image_path;
  return null;
}
/**
 * يُنشئ عنوان العرض للقسم من نوعه.
 *
 * @param section - كائن المكتبة (Library).
 * @returns النص العربي المقابل لنوع القسم، أو اسم المكتبة إن وُجد.
 */
/**
 * يُنشئ عنوان العرض للقسم من نوعه.
 */
export function getSectionDisplayTitle(section: Library): string {
  if (section.name) return section.name;
  const type = section.type?.toLowerCase();
  const translations: Record<string, string> = {
    main: "الأقسام الرئيسية",
    movie: "الأفلام",
    movies: "الأفلام",
    series: "المسلسلات",
    music: "الصوتيات",
    photo: "الصور",
    theater: "المسرحيات",
    series_anime: "مسلسلات الأنمي",
    series_tv: "البرامج التلفزيونية",
    series_sports: "البرامج الرياضية",
    series_ramadan: "مسلسلات رمضان",
    series_deen: "البرامج الدينية",
    series_kids: "مسلسلات الأطفال",
    series_learn: "البرامج التعليمية",
    series_doc: "البرامج الوثائقية",
  };
  return translations[type] ?? section.type ?? "قسم";
}