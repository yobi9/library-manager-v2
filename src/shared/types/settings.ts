/**
 * Types shared between the backend and frontend for the settings layer.
 *
 * الغرض: توحيد شكل الإعدادات التي تعبر حدود الواجهة (الباك-إند ← الواجهة العامة
 * والأدمن) بحيث لا تُعرَّف نفس الحقول في عدة ملفات بشكل متباعد.
 *
 * مصدر الحقيقة: هذه الأنواع يجب أن تبقى متطابقة مع `SettingsRegistry`
 * (`src/backend/settings/settings-registry.ts`) — أي إضافة إعداد جديد يجب أن
 * تنعكس هنا وفي السجل معاً.
 *
 * النطاق: `PublicSettings` تغطي الإعدادات الظاهرة عبر `GET /api/settings` فقط؛
 * `AdminSettings` تغطي كل المفاتيح عبر `GET /api/settings/all`.
 *
 * القيود: المفاتيح الإدارية الحساسة (`maintenance_mode`, `enable_registration`,
 * `deep_scan_enabled`, `auto_backup_*`) غير مضمّنة في `PublicSettings`.
 */

/** عنصر حصري واحد في شريط المحتوى الحصري (Hero) أعلى الصفحة الرئيسية. */
export interface ExclusiveSettingItem {
  media_id?: number | string;
  title: string;
  type?: string;
  image?: string;
  desc?: string;
  desc_ar?: string;
  href?: string;
  tags?: string[];
  sort_order?: number;
}

/**
 * الإعدادات العامة الظاهرة للواجهة العامة (المستهلك غير المسجّل).
 */
export interface PublicSettings {
  [key: string]: unknown;
  site_title?: string;
  site_description?: string;
  site_owner?: string;
  language?: string;
  system_version?: string;
  official_site_url?: string;
  contact_phone?: string;
  copyright_text?: string;
  social_links_facebook?: string;
  social_links_twitter?: string;
  social_links_instagram?: string;
  social_links_youtube?: string;
  social_links_telegram?: string;
  social_links_whatsapp?: string;
  viewer_access_mode?: string;
  results_per_page?: number;
  show_movie?: boolean;
  show_series?: boolean;
  show_series_anime?: boolean;
  show_series_kids?: boolean;
  show_series_sports?: boolean;
  show_series_tv?: boolean;
  show_series_ramadan?: boolean;
  show_series_deen?: boolean;
  show_series_doc?: boolean;
  show_series_learn?: boolean;
  exclusive_items?: ExclusiveSettingItem[];
  storage_mode?: string;
  download_images?: boolean;
  download_cast_images?: boolean;
}

/**
 * كل الإعدادات كما تُقرأ عبر `/api/settings/all` (مصادقة أدمن فقط).
 * تتضمن `PublicSettings` زائد المفاتيح الإدارية غير العامة.
 */
export interface AdminSettings extends PublicSettings {
  enable_registration?: boolean;
  maintenance_mode?: boolean;
  deep_scan_enabled?: boolean;
  image_storage_root?: string;
  image_placeholder_dir?: string;
  tmdb_api_key?: string;
  auto_backup_enabled?: boolean;
  auto_backup_interval_hours?: number;
  listen_address?: string;
  app_port?: string;
  auto_restart_on_port_change?: boolean;
}
