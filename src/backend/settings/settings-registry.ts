/**
 * Central Settings Registry — single source of truth for every application setting.
 *
 * الغرض: تعريف موحّد لجميع إعدادات النظام (المفتاح، النوع، القيمة الافتراضية، الفئة،
 * قابلية الظهور العام، وقواعد التحقق) بحيث لا يتكرر أي تعريف في طبقات أخرى. أي إعداد
 * جديد يجب أن يُسجَّل هنا أولاً ثم يُقرأ/يُكتب عبر `SettingsService` فقط.
 *
 * مصدر الحقيقة: هذا الملف هو المرجع الوحيد للافتراضيات والتحقق في الباك-إند. الأنواع
 * الأمامية (`PublicSettings`/`AdminSettings`) في `src/shared/types/settings.ts` تُشتق
 * يدوياً من هذه القائمة ويجب أن تبقى متطابقة معها.
 *
 * النطاق: يغطي الإعدادات المخزنة في جدول `settings` فقط (بما فيها البذور القديمة
 * `listen_address`/`app_port`/`auto_restart_on_port_change`).
 *
 * القيود: مفاتيح المشروع القديم (`main_name`, `main_desc`, `main_phone`,
 * `main_facebook`, `mubasher_port`, `cardsEnabled`, `is_stop_constraction`,
 * `is_only_app`, `estra7ah_type`) غير مُسجّلة هنا وتُعتبر ميتة — لا تُقرأ من أي
 * واجهة جديدة ولا يجب كتابتها مرة أخرى.
 */
export type SettingType = "boolean" | "number" | "string" | "enum" | "json";

/**
 * فئة تنظيمية للإعدادات تُستخدم لتجميع الإعدادات في الواجهات (غير إلزامية).
 */
export type SettingCategory =
  "general" | "social" | "viewer" | "home" | "storage" | "backup" | "network" | "system";

/**
 * تعريف إعداد واحد في السجل.
 *
 * @property key - مفتاح الإعداد كما يُخزَّن في عمود `settings.key`.
 * @property type - نوع القيمة؛ يحدد التحويل والتحقق والنمط الافتراضي.
 * @property defaultValue - القيمة الافتراضية المستخدمة عند غياب الصف في قاعدة البيانات.
 * @property category - فئة تجميعية للإعدادات.
 * @property isPublic - هل يظهر هذا الإعداد في `GET /api/settings` (الواجهة العامة).
 * @property enumValues - القيم المسموحة عندما يكون `type` مساوياً `"enum"`.
 * @property min - الحد الأدنى عندما يكون `type` مساوياً `"number"`.
 * @property max - الحد الأعلى عندما يكون `type` مساوياً `"number"`.
 * @property maxLength - أقصى طول للنص عندما يكون `type` مساوياً `"string"`.
 * @property description - وصف وظيفي للإعداد.
 * @property legacy - إعداد موروث من البنية القديمة بلا مستهلك حي في النظام الجديد.
 * @property isSecret - إعداد سري تُقنّع قيمته (القديمة والجديدة) في
 *          `settings_audit_log` حتى لا يتسرب في السجلات (مثل مفتاح API).
 */
export interface SettingDefinition {
  key: string;
  type: SettingType;
  defaultValue: unknown;
  category: SettingCategory;
  isPublic: boolean;
  enumValues?: readonly string[];
  min?: number;
  max?: number;
  maxLength?: number;
  description: string;
  legacy?: boolean;
  isSecret?: boolean;
}

/**
 * قائمة إعدادات النظام كاملة — المرجع الوحيد للأنواع والافتراضيات.
 */
export const SETTINGS_REGISTRY: readonly SettingDefinition[] = [
  // ============ General ============
  {
    key: "site_title",
    type: "string",
    defaultValue: "Media Library",
    category: "general",
    isPublic: true,
    maxLength: 200,
    description: "اسم الشبكة/الموقع الظاهر للمستخدمين في الواجهة العامة.",
  },
  {
    key: "site_description",
    type: "string",
    defaultValue: "",
    category: "general",
    isPublic: true,
    maxLength: 1000,
    description: "وصف موجز للخدمة يظهر في الواجهة العامة.",
  },
  {
    key: "site_owner",
    type: "string",
    defaultValue: "Yuobi",
    category: "general",
    isPublic: true,
    maxLength: 100,
    description: "اسم مالك/مشغّل النظام.",
  },
  {
    key: "language",
    type: "enum",
    defaultValue: "ar",
    enumValues: ["ar", "en", "fr", "es", "de", "tr"],
    category: "general",
    isPublic: true,
    description: "اللغة الافتراضية للواجهة.",
  },
  {
    key: "system_version",
    type: "string",
    defaultValue: "1.0.0",
    category: "system",
    isPublic: true,
    description: "رقم إصدار النظام المعروض عاماً.",
  },
  {
    key: "official_site_url",
    type: "string",
    defaultValue: "",
    category: "general",
    isPublic: true,
    maxLength: 500,
    description: "رابط الموقع الرسمي.",
  },
  {
    key: "contact_phone",
    type: "string",
    defaultValue: "",
    category: "general",
    isPublic: true,
    maxLength: 50,
    description: "رقم التواصل مع الإدارة.",
  },
  {
    key: "copyright_text",
    type: "string",
    defaultValue: "",
    category: "general",
    isPublic: true,
    maxLength: 500,
    description: "نص الحقوق المحفوظة الظاهر في تذييل الموقع.",
  },

  // ============ Social ============
  {
    key: "social_links_facebook",
    type: "string",
    defaultValue: "",
    category: "social",
    isPublic: true,
    description: "رابط صفحة فيسبوك.",
  },
  {
    key: "social_links_twitter",
    type: "string",
    defaultValue: "",
    category: "social",
    isPublic: true,
    description: "رابط حساب تويتر/X.",
  },
  {
    key: "social_links_instagram",
    type: "string",
    defaultValue: "",
    category: "social",
    isPublic: true,
    description: "رابط حساب إنستغرام.",
  },
  {
    key: "social_links_youtube",
    type: "string",
    defaultValue: "",
    category: "social",
    isPublic: true,
    description: "رابط قناة يوتيوب.",
  },
  {
    key: "social_links_telegram",
    type: "string",
    defaultValue: "",
    category: "social",
    isPublic: true,
    description: "رابط قناة تيليغرام.",
  },
  {
    key: "social_links_whatsapp",
    type: "string",
    defaultValue: "",
    category: "social",
    isPublic: true,
    description: "رابط واتساب.",
  },

  // ============ Viewer ============
  {
    key: "viewer_access_mode",
    type: "enum",
    defaultValue: "public",
    enumValues: ["public", "protected"],
    category: "viewer",
    isPublic: true,
    description: "نمط حماية الواجهة العامة: public (للكل) أو protected (يتطلب تسجيل دخول).",
  },
  {
    key: "results_per_page",
    type: "number",
    defaultValue: 20,
    category: "viewer",
    isPublic: true,
    min: 1,
    max: 100,
    description: "عدد النتائج الافتراضي في الصفحات العامة.",
  },
  {
    key: "enable_registration",
    type: "boolean",
    defaultValue: true,
    category: "viewer",
    isPublic: false,
    description: "تفعيل/تعطيل تسجيل الحسابات الجديدة (إعداد إداري لا يُكشف عاماً).",
  },
  {
    key: "maintenance_mode",
    type: "boolean",
    defaultValue: false,
    category: "viewer",
    isPublic: false,
    description: "وضع الصيانة: يُغلق الواجهة العامة أمام غير المدراء.",
  },

  // ============ Home sections ============
  {
    key: "show_movie",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم أحدث الأفلام في الصفحة الرئيسية.",
  },
  {
    key: "show_series",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم أحدث المسلسلات في الصفحة الرئيسية.",
  },
  {
    key: "show_series_anime",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم الأنمي في الصفحة الرئيسية.",
  },
  {
    key: "show_series_kids",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم الأطفال في الصفحة الرئيسية.",
  },
  {
    key: "show_series_sports",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم الرياضة في الصفحة الرئيسية.",
  },
  {
    key: "show_series_tv",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم البرامج التلفزيونية في الصفحة الرئيسية.",
  },
  {
    key: "show_series_ramadan",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم المسلسلات الرمضانية في الصفحة الرئيسية.",
  },
  {
    key: "show_series_deen",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم المحتوى الديني في الصفحة الرئيسية.",
  },
  {
    key: "show_series_doc",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم الوثائقيات في الصفحة الرئيسية.",
  },
  {
    key: "show_series_learn",
    type: "boolean",
    defaultValue: false,
    category: "home",
    isPublic: true,
    description: "إظهار قسم المحتوى التعليمي في الصفحة الرئيسية.",
  },
  {
    key: "exclusive_items",
    type: "json",
    defaultValue: [],
    category: "home",
    isPublic: true,
    description: "قائمة العناصر الحصرية (Hero) — مصفوفة JSON تُعرض أعلى الصفحة الرئيسية.",
  },

  // ============ Storage ============
  {
    key: "storage_mode",
    type: "enum",
    defaultValue: "local",
    enumValues: ["local", "media_folder" ],
    category: "storage",
    isPublic: true,
    description: "طريقة تخزين الصور/الوسائط: في مجلد عنصر الميديا  (media_folder)،  ",
  },
  {
    key: "download_images",
    type: "boolean",
    defaultValue: false,
    category: "storage",
    isPublic: true,
    description: "تنزيل صور البوستر/الخلفيات محلياً أثناء الإثراء.",
  },
  {
    key: "download_cast_images",
    type: "boolean",
    defaultValue: false,
    category: "storage",
    isPublic: true,
    description: "تنزيل صور الممثلين محلياً أثناء الإثراء.",
  },
  {
    key: "deep_scan_enabled",
    type: "boolean",
    defaultValue: false,
    category: "storage",
    isPublic: false,
    description: "تفعيل الفحص العميق للمكتبات (إعداد إداري).",
  },
  {
    key: "image_storage_root",
    type: "string",
    defaultValue: "D:\\assets\\images\\enriched",
    category: "storage",
    isPublic: false,
    maxLength: 500,
    description:
      "المسار الأساسي لتخزين صور الإثراء المحلية — مسار مطلق خارج جذر المشروع (مثل D:\\assets\\images\\enriched) يُقرأ منه مباشرة، أو مسار نسبي لجذر الويب يُحل داخل public. صيغة المسارات المخزَّنة في القاعدة تبقى web-relative (/assets/images/enriched/...).",
  },
  {
    key: "image_placeholder_dir",
    type: "string",
    defaultValue: "/assets/images/placeholders",
    category: "storage",
    isPublic: false,
    maxLength: 500,
    description: "المسار الأساسي (نسبي لجذر الويب) لصور placeholders (SVG).",
  },
  {
    key: "tmdb_api_key",
    type: "string",
    defaultValue: "",
    category: "storage",
    isPublic: false,
    maxLength: 500,
    isSecret: true,
    description:
      "مفتاح TMDB API لخدمة الإثراء — يُثبَّت في قاعدة البيانات عند حفظه من منصة التحكم، ويُحمَّل عند بدء الخدمة ليفعَّل في الذاكرة بعد إعادة التشغيل. قيمته السرية تُقنّع في سجل تدقيق الإعدادات.",
  },

  // ============ Backup ============
  {
    key: "auto_backup_enabled",
    type: "boolean",
    defaultValue: false,
    category: "backup",
    isPublic: false,
    description: "تفعيل النسخ الاحتياطي التلقائي لقاعدة البيانات.",
  },
  {
    key: "auto_backup_interval_hours",
    type: "number",
    defaultValue: 24,
    category: "backup",
    isPublic: false,
    min: 1,
    max: 168,
    description: "الفترة الزمنية بين النسخ الاحتياطية التلقائية (بالساعات).",
  },

  // ============ Network (legacy seeds — بلا مستهلك حي) ============
  {
    key: "listen_address",
    type: "string",
    defaultValue: "0.0.0.0",
    category: "network",
    isPublic: false,
    legacy: true,
    description: "عنوان الاستماع للخادم (بذرة قديمة — غير مستخدمة في البنية الجديدة).",
  },
  {
    key: "app_port",
    type: "string",
    defaultValue: "4000",
    category: "network",
    isPublic: false,
    legacy: true,
    description: "منفذ التشغيل (بذرة قديمة — غير مستخدمة في البنية الجديدة).",
  },
  {
    key: "auto_restart_on_port_change",
    type: "boolean",
    defaultValue: true,
    category: "network",
    isPublic: false,
    legacy: true,
    description: "إعادة التشغيل عند تغيير المنفذ (بذرة قديمة — غير مستخدمة).",
  },
];

const SETTINGS_BY_KEY = new Map<string, SettingDefinition>(
  SETTINGS_REGISTRY.map((def) => [def.key, def]),
);

const PUBLIC_DEFINITIONS = SETTINGS_REGISTRY.filter((def) => def.isPublic);

/**
 * إرجاع تعريف إعداد عبر مفتاحه.
 *
 * @param key - مفتاح الإعداد.
 * @returns تعريف الإعداد أو `undefined` إذا لم يكن مسجلاً.
 */
export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return SETTINGS_BY_KEY.get(key);
}

/**
 * إرجاع كل قيم الإعدادات الافتراضية (جميع المفاتيح المسجلة).
 *
 * @returns خريطة `key → defaultValue` تُستخدم لإعادة الضبط إلى الوضع الافتراضي.
 */
export function getDefaultSettings(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const def of SETTINGS_REGISTRY) {
    defaults[def.key] = def.defaultValue;
  }
  return defaults;
}

/**
 * بناء كائن الإعدادات العامة (الـ DTO العام) من القيم الخام القادمة من قاعدة البيانات.
 *
 * يُرجِع فقط الإعدادات التي `isPublic === true` مع تطبيق القيم الافتراضية
 * لأي مفتاح غائب، مع ضمان أن عناصر `json` ذات الافتراضي المصفوفي تبقى مصفوفة.
 *
 * @param settings - القيم الخام من `SettingsRepository.getAllSettings()`.
 * @returns كائن إعدادات عامة كامل بكل المفاتيح العامة.
 */
export function buildPublicSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const def of PUBLIC_DEFINITIONS) {
    let value = settings[def.key] ?? def.defaultValue;
    if (def.type === "json" && Array.isArray(def.defaultValue) && !Array.isArray(value)) {
      value = def.defaultValue;
    }
    result[def.key] = value;
  }
  return result;
}

/**
 * التحقق من قيمة إعداد وتطبيعها وفق تعريفه في السجل.
 *
 * - `boolean`: يحول النصوص ("true"/"1") إلى Boolean حقيقي.
 * - `number`: يتحقق من أنه رقم ضمن `min`/`max`.
 * - `enum`: يتحقق من انتماء القيمة إلى `enumValues`.
 * - `string`: يفرض أقصى طول عبر `maxLength`.
 * - `json`: يمرّر الكائنات/المصفوفات كما هي.
 *
 * @param key - مفتاح الإعداد (يجب أن يكون مسجلاً في السجل).
 * @param value - القيمة المراد التحقق منها.
 * @returns القيمة المطبّعة بعد التحقق.
 * @throws `Error` إذا كانت القيمة لا تلبي قواعد النوع، أو إذا كان المفتاح غير معروف.
 */
export function validateSetting(key: string, value: unknown): unknown {
  const def = SETTINGS_BY_KEY.get(key);
  if (!def) {
    throw new Error(`Setting "${key}" is not registered in the settings registry`);
  }

  switch (def.type) {
    case "boolean": {
      if (typeof value === "string") {
        return value === "true" || value === "1";
      }
      return Boolean(value);
    }
    case "number": {
      const num = Number(value);
      if (Number.isNaN(num)) throw new Error(`Setting "${key}" must be a number`);
      if (def.min !== undefined && num < def.min) {
        throw new Error(`Setting "${key}" must be at least ${def.min}`);
      }
      if (def.max !== undefined && num > def.max) {
        throw new Error(`Setting "${key}" must be at most ${def.max}`);
      }
      return num;
    }
    case "enum": {
      const str = String(value);
      if (def.enumValues && !def.enumValues.includes(str)) {
        throw new Error(`Setting "${key}" must be one of: ${def.enumValues.join(", ")}`);
      }
      return str;
    }
    case "string": {
      const str = String(value);
      if (def.maxLength !== undefined && str.length > def.maxLength) {
        throw new Error(`Setting "${key}" must be at most ${def.maxLength} characters`);
      }
      return str;
    }
    case "json": {
      if (typeof value === "object" && value !== null) return value;
      throw new Error(`Setting "${key}" must be a JSON object or array`);
    }
    default:
      return value;
  }
}

/**
 * قائمة مفاتيح الإعدادات المسجلة في السجل.
 */
export const REGISTERED_SETTING_KEYS: readonly string[] = SETTINGS_REGISTRY.map((def) => def.key);
