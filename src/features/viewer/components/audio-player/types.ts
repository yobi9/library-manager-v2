// src/features/viewer/components/audio-player/types.ts

/**
 * ============================================================
 * المصدر الوحيد للحقيقة (Single Source of Truth) لأنواع الصوتيات
 * ============================================================
 * جميع الملفات (AudioPlayer, media-helpers) تستورد الأنواع من هنا
 * لتجنب التكرار. لا توجد مصفوفة موازية للأنواع الصوتية في أي مكان آخر.
 */

/**
 * الأنواع الصوتية المعتمدة في النظام.
 * تستخدم في: buildMediaUrl, isAudioType
 */
export const AUDIO_TYPES = [
  "music",
  "singer",
  "album",
  "song",
] as const;

/**
 * نوع اتحادي (Union Type) للأنواع الصوتية.
 * يستنتج تلقائياً من المصفوفة أعلاه.
 */
export type AudioType = (typeof AUDIO_TYPES)[number];

/**
 * دالة مساعدة للتحقق مما إذا كان نوع ما صوتياً.
 * تستخدم في: buildMediaUrl
 */
export function isAudioType(type?: string): type is AudioType {
  if (!type) return false;
  return AUDIO_TYPES.includes(type as AudioType);
}

/**
 * ============================================================
 * أنواع خاصة بمكون مشغل الصوت (AudioPlayer)
 * ============================================================
 */

/**
 * يمثل مقطعاً صوتياً فردياً داخل ألبوم أو قائمة تشغيل.
 * يُبنى من عناصر `children` لنوع `album` (غالباً `song`).
 */
export interface AudioTrack {
  /** معرف العنصر الوسائطي (يُستخدم لبناء مسار البث `/api/media/{id}/stream`) */
  id: string | number;
  /** عنوان المقطع */
  title: string;
  /** نوع العنصر (عادة 'song') */
  type?: string;
  /** سنة الإنتاج */
  year?: number | string;
  /** مسار صورة الغلاف (poster) */
  poster_path?: string | null;
  /** التقييم */
  rating?: number;
  /** مدة المقطع بالثواني (إن توفرت من قاعدة البيانات) */
  duration?: number;
}

/**
 * خصائص مكون مشغل الصوت المدمج (Album Player).
 * المشغل مُتحكم به بالكامل من الأعلى: يستقبل قائمة المقاطع والفهرس النشط،
 * ويُخطِر بالطلب عبر `onTrackChange` عند الانتقال إلى مقطع آخر
 * (زر سابق/تالي أو انتهاء المقطع الحالي).
 */
export interface AudioPlayerProps {
  /** قائمة المقاطع (playlist) المراد تشغيلها بالتتابع. */
  tracks: AudioTrack[];
  /** فهرس المقطع النشط حالياً (يبدأ من الصفر). */
  currentIndex: number;
  /** معرّف يطلب من الأب تغيير المقطع النشط (سابق/تالي/تقدم تلقائي). */
  onTrackChange: (index: number) => void;
}
