/**
 * قواعد اشتقاق الأنواع لجهاز الفحص (Scanner Hierarchy Rules).
 *
 * - الغاية: جهة واحدة مسؤولة عن تحديد نوع كل عنصر (مجلد/ملف) يُكتشف أثناء
 *   اجتياز المكتبات، وفق نوع المكتبة وعمق العنصر وكونه ملفاً أم مجلداً.
 * - المصدر الموثوق: هذه القواعد هي SSOT لسلوك المسح الهرمي؛ يستدعيها
 *   `DirectoryWalker` عبر `resolveType` ولا يجوز تكرار منطقها خارجها.
 * - النطاق: أنواع المكتبات المذكورة في `LibraryType` وعلاقات أبوّتها.
 * - القيود: القرار يعتمد على `libraryType` و`depth` فقط؛ لا يتأثر بنوع
 *   العنصر الأب (كان يُمرَّر سابقاً عبر `parentMedia` وأُزيل لعدم استخدامه).
 */

import type { LibraryType } from "./scanner-events";

/**
 * أنواع المكتبات الصوتية الهرمية (جذر → ألبوم → أغنية).
 *
 * - الغاية: التمييز بين المكتبات الصوتية والفيديو عند اشتقاق الأنواع:
 *   مجلد العمق 1 يتحول إلى `album` والملفات إلى `song`.
 * - المصدر الموثوق: هذا الملف. مجموعة الواجهة الأمامية `AUDIO_TYPES`
 *   (`src/features/viewer/components/audio-player/types.ts`) أوسع وتشمل
 *   العُقد والوريقات (`album`/`song`) ولا تُستخدم في منطق فحص الـ Backend.
 * - النطاق: مكتبات الجذر الهرمية الصوتية فقط.
 * - الاكتمال: القائمة كاملة وتشمل `music` و`singer` و`audio_deen`.
 */
export const AUDIO_LIBRARY_TYPES: ReadonlySet<LibraryType> = new Set([
  "music",
  "singer",
  "audio_deen",
]);

/**
 * علاقات الأبوّة في المكتبات الهرمية: لكل نوع أب، المجلدات والملفات المسموحة
 * كأبناء مباشرين.
 *
 * - المصدر الموثوق: هذا الملف (يُستهلك من `HierarchyValidator`).
 * - النطاق: يغطي المكتبات الهرمية وعُقدها الوسيطة (`season`/`album`).
 */
interface RuleRelationships {
  [parentType: string]: { directories: string[]; files: string[] };
}

/**
 * إعداد القواعد الكامل: تصنيف أنواع المكتبات، علاقات الأبوّة، أقصى عمق
 * للأنواع غير الهرمية، وأنواع الوريقات.
 *
 * - المصدر الموثوق: يُبنى في `HierarchyRules.defineRules`.
 * - الاكتمال: مصفوفات الأنواع تطابق اتحاد `LibraryType`.
 */
interface RuleSet {
  libraryTypes: {
    CONTAINER: LibraryType[];
    SINGLE_FILE: LibraryType[];
    SINGLE_FLAT: LibraryType[];
    HIERARCHICAL: LibraryType[];
  };
  relationships: RuleRelationships;
  maxDepth: Record<string, number>;
  leafTypes: string[];
}

/**
 * معاملات `HierarchyRules.resolveType`.
 */
interface ResolveParams {
  /** نوع المكتبة التي يقع العنصر ضمنها. */
  libraryType: LibraryType;
  /** عمق العنصر من جذر المكتبة (الجذر = 0). */
  depth: number;
  /** هل العنصر ملف أم مجلد. */
  isFile: boolean;
}

/**
 * قواعد اشتقاق الأنواع وسجلّها الوحيد المستهلك أثناء المسح.
 *
 * - الاستخدام: `DirectoryWalker` يستدعي `resolveType` لكل مجلد/ملف،
 *   و`HierarchyValidator` يقرأ `rules`/`getMaxDepth`/`isLeafType` للفحص.
 * - القيود: لا تُستخدم هذه الطبقة لأغراض واجهة المستخدم؛ الترجمة والتوجيه
 *   الصوتي لهما مصادر موثوقة خاصة بهما.
 */
export class HierarchyRules {
  /** الإعدادات الكاملة للقواعد (للقراءة والفحص لاحقاً). */
  readonly rules: RuleSet;

  constructor() {
    this.rules = this.defineRules();
  }

  /**
   * يبني إعداد القواعد الكامل (تصنيفات، علاقات، أعماق، أوريقات).
   *
   * @returns نسخة `RuleSet` كاملة تُخزَّن مرة واحدة في `rules`.
   */
  private defineRules(): RuleSet {
    return {
      libraryTypes: {
        CONTAINER: ["main"],
        SINGLE_FILE: ["movie", "theater"],
        SINGLE_FLAT: [
          "vidsSameFolder",
          "appsSameFolder",
          "audioSameFolder",
          "imagesSameFolder",
          "booksSameFolder",
          "book",
          "app",
          "photo",
        ],
        HIERARCHICAL: [
          "series",
          "series_anime",
          "series_sports",
          "series_deen",
          "series_ramadan",
          "series_tv",
          "series_learn",
          "series_kids",
          "series_doc",
          "music",
          "singer",
          "audio_deen",
        ],
      },
      relationships: {
        series: { directories: ["season"], files: [] },
        series_sports: { directories: ["season"], files: [] },
        series_anime: { directories: ["season"], files: [] },
        series_deen: { directories: ["season"], files: [] },
        series_ramadan: { directories: ["season"], files: [] },
        series_tv: { directories: ["season"], files: [] },
        series_learn: { directories: ["season"], files: [] },
        series_kids: { directories: ["season"], files: [] },
        series_doc: { directories: ["season"], files: [] },
        audio_deen: { directories: ["album"], files: [] },
        music: { directories: ["album"], files: [] },
        singer: { directories: ["album"], files: [] },
        season: { directories: [], files: ["episode"] },
        album: { directories: [], files: ["song"] },
        movie: { directories: [], files: [] },
        theater: { directories: [], files: [] },
        episode: { directories: [], files: [] },
        song: { directories: [], files: [] },
      },
      maxDepth: {
        movie: 1,
        theater: 1,
      },
      leafTypes: [
        "episode",
        "song",
        "movie",
        "theater",
        "book",
        "app",
        "photo",
        "vidsSameFolder",
        "audioSameFolder",
        "imagesSameFolder",
        "booksSameFolder",
        "appsSameFolder",
      ],
    };
  }

  /**
   * يشتق نوع عنصر ممسوح (مجلد/ملف) وفق نوع المكتبة وعمقه.
   *
   * القواعد المطبقة:
   * - هرمي صوتي: مجلد عمق 1 = `album`، ملفات عمق ≥ 1 = `song`.
   * - هرمي فيديو: مجلد عمق 1 = `season`، ملفات عمق ≥ 1 = `episode`.
   * - أحادي الملف (`movie`/`theater`): المجلد الجذر والملفات على عمق 0/1.
   * - مسطّح: المجلد الجذر فقط؛ الملفات تُتجاهل (تعيد `null`).
   *
   * @param params - نوع المكتبة، عمق العنصر، وهل هو ملف.
   * @returns النوع المشتق، أو `null` عندما لا يكون للعنصر تصنيف (يُتخطى).
   */
  resolveType(params: ResolveParams): string | null {
    const { libraryType, depth, isFile } = params;

    if (isFile) {
      if (this.isHierarchicalType(libraryType)) {
        return AUDIO_LIBRARY_TYPES.has(libraryType) ? "song" : "episode";
      }
      if (libraryType === "movie" && (depth === 0 || depth === 1)) {
        return "movie";
      }
      if (this.isFlatType(libraryType) && depth === 1) return null;
      return null;
    }

    if (this.isSingleFileType(libraryType)) return depth === 0 ? libraryType : null;

    if (this.isHierarchicalType(libraryType)) {
      if (depth === 0) return libraryType;
      if (depth === 1) return AUDIO_LIBRARY_TYPES.has(libraryType) ? "album" : "season";
      return null;
    }

    if (this.isFlatType(libraryType)) return depth === 0 ? libraryType : null;

    return null;
  }

  /**
   * يتحقق إن كان النوع من المكتبات أحادية الملف (`movie`/`theater`).
   *
   * @param type - نوع المكتبة.
   * @returns `true` عند عضوية النوع في `SINGLE_FILE`.
   */
  isSingleFileType(type: string): boolean {
    return this.rules.libraryTypes.SINGLE_FILE.includes(type as LibraryType);
  }

  /**
   * يتحقق إن كان النوع مكتبة هرمية (جذر → عُقد وسيطة → أوريقات).
   *
   * @param type - نوع المكتبة.
   * @returns `true` عند عضوية النوع في `HIERARCHICAL`.
   */
  isHierarchicalType(type: string): boolean {
    return this.rules.libraryTypes.HIERARCHICAL.includes(type as LibraryType);
  }

  /**
   * يتحقق إن كان النوع مكتبة مسطّحة (ملفات بلا هيكلة داخلية).
   *
   * @param type - نوع المكتبة.
   * @returns `true` عند عضوية النوع في `SINGLE_FLAT`.
   */
  isFlatType(type: string): boolean {
    return this.rules.libraryTypes.SINGLE_FLAT.includes(type as LibraryType);
  }

  /**
   * يحدد أقصى عمق مسموح لنوع مكتبة.
   *
   * - المكتبات الهرمية: حد ثابت `10` (لا يُقرأ جدول `maxDepth` لها).
   * - غير الهرمية: تُقرأ من الجدول (`movie`/`theater` = 1).
   *
   * @param libraryType - نوع المكتبة.
   * @returns أقصى عمق، أو `0` لنوع غير معرّف.
   */
  getMaxDepth(libraryType: string): number {
    if (this.isHierarchicalType(libraryType)) return 10;
    return this.rules.maxDepth[libraryType] ?? 0;
  }

  /**
   * يتحقق إن كان النوع وريقة (لا يُسمح بأبناء تحته).
   *
   * @param type - نوع العنصر.
   * @returns `true` إذا كان النوع في `leafTypes`.
   */
  isLeafType(type: string): boolean {
    return this.rules.leafTypes.includes(type);
  }
}
