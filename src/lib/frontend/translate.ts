import { CONTENT_TYPES } from "@/lib/frontend/media-constants";

export const MEDIA_TYPES = {
  MOVIE: "movie",
  SERIES: "series",
  SERIES_ANIME: "series_anime",
  SERIES_SPORTS: "series_sports",
  SERIES_RAMADAN: "series_ramadan",
  SERIES_TV: "series_tv",
  SERIES_DEEN: "series_deen",
  SERIES_KIDS: "series_kids",
  SERIES_LEARN: "series_learn",
  SERIES_DOC: "series_doc",
  audio_deen: "audio_deen",
  THEATER: "theater",
  MUSIC: "music",
  PHOTO: "photo",
  SEASON: "season",
  EPISODE: "episode",
  APPS: "apps",
  BOOK: "book",
  ALBUM: "album",
  PERSON: "person",
} as const;

export const LIBRARY_TYPES = {
  MOVIE: "movie",
  MAIN: "main",
  LINKED: "linked",
  SERIES: "series",
  MUSIC: "music",
  PHOTO: "photo",
  SERIES_ANIME: "series_anime",
  SERIES_SPORTS: "series_sports",
  SERIES_RAMADAN: "series_ramadan",
  SERIES_TV: "series_tv",
  SERIES_DEEN: "series_deen",
  SERIES_KIDS: "series_kids",
  SERIES_LEARN: "series_learn",
  SERIES_DOC: "series_doc",
  audio_deen: "audio_deen",
  THEATER: "theater",
  AUDIO_SAME_FOLDER: "audioSameFolder",
  VIDEO_SAME_FOLDER: "vidsSameFolder",
  APPS_SAME_FOLDER: "appsSameFolder",
  BOOK: "book",
  APP: "app",
  ALBUM: "album",
  APPS: "apps",
  BOOKS_SAME_FOLDER: "booksSameFolder",
  IMAGES_SAME_FOLDER: "imagesSameFolder",
} as const;

const ARABIC_TYPE_NAMES: Record<string, string> = {
  movie: "أفلام",
  series: "مسلسلات",
  series_anime: "أنمي",
  series_sports: "رياضة",
  series_ramadan: "رمضان",
  series_tv: "برامج تلفزيونية",
  series_deen: "دينية",
  series_kids: "أطفال",
  series_doc: "وثائقيات",
  series_learn: "تعليمية",
  theater: "مسرحيات",
  // === التعديل المطلوب هنا ===
  music: "صوتيات",        // كانت "موسيقى" ← أصبحت "صوتيات"
  photo: "صور",
    apps: "تطبيقات",
  book: "كتاب",
  episode: "حلقة",
     album: "ألبوم",
 audio_deen: "صوتيات دينية", // أو "مكتبة دينية"
  singer: "منشد", // أو "فنان" // أو "شيخ"  // أو "قارئ" حسب السياق
song: "مقطع", // أو "سورة", // أو "تلاوة"
  season: "موسم",
};

const TYPE_TRANSLATIONS: Record<string, string> = {
  movie: "فيلم",
  series: "مسلسل",
  season: "موسم",
  episode: "حلقة",
  theater: "مسرحية",
  music: "صوتيات",        // كانت "موسيقى" ← أصبحت "صوتيات"
  photo: "صور",
  series_anime: "أنمي",
  series_sports: "رياضة",
  series_deen: "ديني",
  series_ramadan: "رمضاني",
  series_tv: "تلفزيوني",
  series_learn: "تعليمي",
  series_kids: "أطفال",
  series_doc: "وثائقي",
  apps: "تطبيقات",
  book: "كتاب",
  album: "ألبوم",
  audio_deen: "صوتيات دينية", // أو "مكتبة دينية"
  singer: "منشد", // أو "قارئ" حسب السياق
song: "مقطع", // أو "سورة", // أو "تلاوة"
 
};

export function translateMediaType(type?: string): string {
  if (!type) return "محتوى";
  const translation = TYPE_TRANSLATIONS[type];
  if (translation) return translation;
  if (type.startsWith("series_")) return "مسلسل";
  if (type === "main") return "رئيسي";
  if (type === "library") return "مكتبة";
  return "محتوى";
}

/**
 * خيارات قائمة الأنواع في واجهة التحكم (فلتر القائمة وحقل النوع في نافذة التعديل).
 * مشتقة من `CONTENT_TYPES` — المجموعة الإنتاجية الموافقة لتعريف الـ Backend.
 */
export const MEDIA_TYPE_OPTIONS = CONTENT_TYPES.map((type) => ({
  value: type,
  label: translateMediaType(type),
}));

export function getArabicTypeName(type: string): string {
  return ARABIC_TYPE_NAMES[type] || "محتوى";
}

export function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}د`;
  if (m === 0) return `${h}س`;
  return `${h}س ${m}د`;
}

export function formatViews(views?: number): string {
  if (!views || views <= 0) return "0";
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
}

export function isArabic(text: string): boolean {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(text);
}

export const DEPARTMENT_LABELS: Record<string, string> = {
  Director: "إخراج",
  Cast: "الممثلون",
  Production: "الإنتاج",
  Studio: "استوديو",
  Writer: "تأليف",
  Screenplay: "سيناريو",
  Novel: "رواية",
  Crew: "طاقم العمل",
  Actor: "ممثل",
  "Production Companies": "شركات الإنتاج",
};

export const SORT_OPTIONS = [
  { value: "recent", label: "تاريخ الإضافة" },
  { value: "year", label: "سنة الإنتاج" },
  { value: "rating", label: "التقييم" },
  { value: "alpha", label: "الأبجدية" },
] as const;

export function buildYearOptions(years?: number[]) {
  return [
    { value: "all", label: "الكل" },
    ...(years?.map((y) => ({ value: String(y), label: String(y) })) || []),
  ];
}

export function buildGenreOptions(genres?: string[]) {
  return [{ value: "all", label: "الكل" }, ...(genres?.map((g) => ({ value: g, label: g })) || [])];
}

export function formatRelativeDate(dateString?: string): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return date.toLocaleDateString("ar-SA");
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
  return date.toLocaleDateString("ar-SA");
}

export function slugify(name: string): string {
  return name.replace(/\s+/g, "_");
}
