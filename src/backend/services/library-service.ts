import { LibraryRepository } from "../repositories/library-repository";
import { MediaRepository } from "../repositories/media-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { logger } from "../observability/logger";
import { ensureDirs } from "../utils/path-utils";
import fs from "fs/promises";
import path from "path";
// في library-service.ts
// أضف الاستيراد في الأعلى إذا لم يكن موجوداً:
import { getDatabase } from "../db/db";

const ALLOWED_TYPES = [
  "main",
  "linked",
  "movie",
  "theater",
  "series",
  "series_anime",
  "series_sports",
  "series_deen",
  "series_ramadan",
  "series_tv",
  "series_learn",
  "series_kids",
  "series_doc",
  "audio_deen",
  "music",
  "photo",
  "book",
  "app",
  "vidsSameFolder",
  "appsSameFolder",
  "audioSameFolder",
  "imagesSameFolder",
  "booksSameFolder",
];

/** مسار مجلد صور المكتبات ضمن `public` (مطابق للتسمية الموروثة من المشروع القديم). */
const LIBRARY_IMAGES_DIR = path.join(process.cwd(), "public", "assets", "images", "libraries");

/** الحد الأقصى لحجم صورة المكتبة المرفوعة (10MB). */
const MAX_LIBRARY_IMAGE_SIZE = 10 * 1024 * 1024;

/** أنواع صور المكتبات المقبولة عند الرفع. */
const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * ملف صورة مرفوع من نموذج multipart (شكل Node.js `File`).
 *
 * - المصدر الموثوق: قيمة `imageFile` التي ينتجها `parseBody` عند تحليل
 *   `multipart/form-data` من `request.formData()`.
 * - النطاق: يمثل فقط صور المكتبات المرفوعة؛ يُرفض أي نوع غير صورة.
 */
export interface UploadedImageFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

/**
 * يتحقق بنيوياً (Type Guard) إن كانت القيمة ملفاً صورة مرفوعاً (File-like).
 *
 * @param value - القيمة القادمة من `parseBody`.
 * @returns `true` إذا كانت القيمة تطابق واجهة الملف المرفوع.
 */
function isUploadedImageFile(value: unknown): value is UploadedImageFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UploadedImageFile>;
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.name === "string" &&
    typeof candidate.type === "string"
  );
}

export class LibraryService {
  constructor(
    private libraryRepo: LibraryRepository,
    private mediaRepo: MediaRepository,
    private activityRepo?: ActivityRepository,
  ) {
    // إنشاء مجلد صور المكتبات `public/assets/images/libraries` عند بدء التشغيل
    // ليكون جاهزاً قبل أول رفع صورة مكتبة — الفشل يُسجَّل فقط ولا يعطّل التشغيل.
    void this.ensureDirectories();
  }

  /**
   * يضمن وجود مجلد صور المكتبات `public/assets/images/libraries` (مسار ثابت
   * نسبي لجذر المشروع، بلا إعداد مؤثر عليه).
   *
   * - السلوك: لا يرمي الخطأ أبداً — الفشل يُسجَّل عبر `logger` فقط.
   *
   * @returns وعد ينجز عند ضمان وجود المجلد (أو تسجيل الفشل).
   */
  async ensureDirectories(): Promise<void> {
    try {
      await ensureDirs([LIBRARY_IMAGES_DIR], "LibraryService");
    } catch (err) {
      logger.error("libraries.dirs_ensure_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getAllLibraries() {
    const libraries = await this.libraryRepo.getAll();
    return libraries.map((lib) => this.toPublicLibrary(lib as Record<string, unknown>));
  }

  async getAllActive() {
    const libraries = await this.libraryRepo.getAllActive();
    return libraries.map((lib) => this.toPublicLibrary(lib as Record<string, unknown>));
  }

  async getLibraryById(id: number) {
    const lib = (await this.libraryRepo.getById(id)) as Record<string, unknown> | undefined;
    if (!lib) return null;
    return this.toPublicLibrary(lib);
  }

  async getContainers() {
    const libs = await this.libraryRepo.getContainers();
    return libs.map((lib) => this.toPublicLibrary(lib as Record<string, unknown>));
  }

  async getLibrariesByParentId(parentId: number) {
    const libs = await this.libraryRepo.getByParent(parentId);
    return libs.map((lib) => this.toPublicLibrary(lib as Record<string, unknown>));
  }

  /**
   * يطبّع نوع المكتبة القادم من الفورم (يزيل المسافات البادئة/التالية) ويتحقق
   * من أنه نوع معرّف.
   *
   * الغاية: منع حفظ قيم ملوّثة مثل `"  audio_deen"` (بمسافات بادئة) التي تجعل
   * الفاحص يتخطّى كل عناصر المكتبة صامتاً لأنها لا تطابق أي قاعدة في
   * `HierarchyRules`. تُستخدم في الإنشاء والتعديل.
   *
   * @param rawType - القيمة الخام لحقل النوع.
   * @returns النوع المطبَّع، أو `null` إن لم يكن نوعاً معرّفاً.
   */
  private normalizeLibraryType(rawType: unknown): string | null {
    const trimmed = typeof rawType === "string" ? rawType.trim() : "";
    return trimmed && ALLOWED_TYPES.includes(trimmed) ? trimmed : null;
  }

  /**
   * يتحقق من هدف اختصار (مكتبة من نوع `linked`) ويُعيد معرّفه الصحيح.
   *
   * الغاية: ضمان أن الاختصار يشير دائماً إلى قسم محتوى فعلي قابل للفتح في
   * الواجهة، لا إلى حاوية ولا إلى اختصار آخر ولا إلى نفسه، وأن الهدف غير مخفي.
   *
   * @param rawTargetId - القيمة الخام لمعرّف المكتبة المستهدفة.
   * @param excludeLibraryId - معرّف المكتبة الحالية لاستبعاد الارتباط الذاتي (أثناء التعديل).
   * @returns معرّف الهدف بعد التحقق.
   * @throws Error إذا كان الهدف مفقوداً أو غير صالح.
   */
  private async resolveLinkedTarget(
    rawTargetId: unknown,
    excludeLibraryId?: number,
  ): Promise<number> {
    const targetId = this.normalizeParentId(rawTargetId);
    if (!targetId) throw new Error("A linked library requires a target section");
    if (targetId === excludeLibraryId) throw new Error("A library cannot link to itself");
    const target = (await this.libraryRepo.getById(targetId)) as
      | Record<string, unknown>
      | undefined;
    if (!target) throw new Error("Target section not found");
    const targetType = String(target["type"] ?? "").trim();
    if (targetType === "main" || targetType === "linked")
      throw new Error("Target must be a content section, not a container or another shortcut");
    if (Boolean(target["hide_section"])) throw new Error("Target section is hidden");
    return targetId;
  }

  async createLibrary(data: Record<string, unknown>) {
    if (!data["name"] || !(data["name"] as string).trim())
      throw new Error("Library name is required");

    const type = this.normalizeLibraryType(data["type"]);
    if (!type) throw new Error("Invalid library type");

    const isContainer =
      type === "main" || data["isContainer"] === true || data["is_container"] === 1;

    const paths = this.parsePaths(data["paths"]);
    const linkedLibraryId =
      type === "linked"
        ? await this.resolveLinkedTarget(
            data["linked_library_id"] ?? data["linkedLibraryId"],
          )
        : null;

    const record = {
      name: ((data["name"] as string) ?? "").trim(),
      type,
      paths: type === "linked" ? "" : isContainer ? "" : paths.join(";"),
      linked_library_id: linkedLibraryId,
      media_count: 0,
      image: isUploadedImageFile(data["imageFile"])
        ? await this.saveLibraryImageFile(data["imageFile"])
        : (data["image"] ?? null),
      parent_id: this.normalizeParentId(data["parent_id"]),
      hide_section: this.toBoolean(data["hideSection"]) ? 1 : 0,
      is_container: isContainer ? 1 : 0,
      language: data["language"] ?? null,
      country: data["country"] ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: data["created_by"] ?? null,
      status: "active",
      is_pinned: this.toBoolean(data["is_pinned"]) ? 1 : 0,
    };

    const created = await this.libraryRepo.create(record);
    const publicLib = this.toPublicLibrary(created as Record<string, unknown>);
    void this.logSystemEvent("library_created", {
      libraryId: publicLib?.library_id,
      name: publicLib?.name,
      type: publicLib?.type,
    });
    return publicLib;
  }

  async updateLibrary(libraryId: number, updateData: Record<string, unknown>) {
    const existing = (await this.libraryRepo.getById(libraryId)) as
      Record<string, unknown> | undefined;
    if (!existing) throw new Error("Library not found");

    const existingType = String(existing["type"] ?? "").trim();
    const type = this.normalizeLibraryType(
      updateData["type"] !== undefined ? updateData["type"] : existingType,
    );
    if (!type) throw new Error("Invalid library type");

    const data: Record<string, unknown> = {
      ...updateData,
      type,
      updated_at: new Date().toISOString(),
    };

    if (updateData["paths"] !== undefined) {
      data["paths"] = this.parsePaths(updateData["paths"]).join(";");
    }
    if (updateData["hideSection"] !== undefined) {
      data["hide_section"] = this.toBoolean(updateData["hideSection"]) ? 1 : 0;
    }
    if (updateData["parent_id"] !== undefined) {
      data["parent_id"] = this.normalizeParentId(updateData["parent_id"]);
    }

    if (type === "linked") {
      data["paths"] = "";
      data["linked_library_id"] = await this.resolveLinkedTarget(
        updateData["linked_library_id"] ?? updateData["linkedLibraryId"] ?? existing["linked_library_id"],
        libraryId,
      );
    } else {
      data["linked_library_id"] = null;
    }

    // رفع صورة جديدة: احفظ الملف على القرص واستبدل قيمة `image`.
    if (isUploadedImageFile(updateData["imageFile"])) {
      const newImage = await this.saveLibraryImageFile(updateData["imageFile"]);
      data["image"] = newImage;
      const oldImage = existing["image"];
      if (typeof oldImage === "string" && oldImage.startsWith("/assets/images/libraries/")) {
        try {
          await fs.unlink(path.join(process.cwd(), "public", oldImage.replace(/^\/+/, "")));
        } catch {
          // الملف القديم قد لا يكون موجوداً — نتحمل غيابه.
        }
      }
    }

    // منع تمرير مفاتيح مساعدة للـ repo (تُحدَّث أعلاه بصيغة snake_case).
    delete data["hideSection"];
    delete data["parentId"];
    delete data["isPinned"];
    delete data["linkedLibraryId"];
    delete data["imageFile"];

    const updated = await this.libraryRepo.update(libraryId, data);
    const publicLib = this.toPublicLibrary(updated as Record<string, unknown>);
    void this.logSystemEvent("library_updated", {
      libraryId,
      name: publicLib?.name,
      fields: Object.keys(data),
    });
    return publicLib;
  }

  /**
   * يحفظ ملف صورة مكتبة مرفوعاً في `public/assets/images/libraries/`.
   *
   * - التسمية: `library-{timestamp}{ext}` (توافق مع الملفات الموروثة من
   *   المشروع القديم).
   * - القيود: يُقبل JPEG/PNG/WebP/GIF فقط وبحجم ≤ 10MB؛ أي انتهاك يرمي خطأ
   *   يُترجم لاستجابة رفض قبل أي كتابة على القرص.
   *
   * @param file - الملف المرفوع (File-like من multipart).
   * @returns المسار الويبي للصورة المحفوظة (يُخزَّن في `libraries.image`).
   */
  private async saveLibraryImageFile(file: UploadedImageFile): Promise<string> {
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(mime)) {
      throw new Error("Unsupported image type (allowed: jpeg, png, webp, gif)");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_LIBRARY_IMAGE_SIZE) {
      throw new Error("Library image too large (max 10MB)");
    }
    const ext = this.extensionFromMime(mime);
    const filename = `library-${Date.now()}${ext}`;
    await fs.mkdir(LIBRARY_IMAGES_DIR, { recursive: true });
    await fs.writeFile(path.join(LIBRARY_IMAGES_DIR, filename), buffer);
    return `/assets/images/libraries/${filename}`;
  }

  /**
   * يحدد امتداد الملف من نوع MIME (افتراضي `.jpg`).
   *
   * @param mime - نوع MIME للصورة.
   * @returns الامتداد الموافق.
   */
  private extensionFromMime(mime: string): string {
    const map: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };
    return map[mime] ?? ".jpg";
  }

  /**
   * يحول قيمة `parent_id` (رقم أو سلسلة رقمية) إلى رقم صحيح أو null.
   *
   * @param value - القيمة الخام من الفورم/المحلِّل.
   * @returns رقم صحيح موجب أو `null` عند الغياب/الفارغ/غير الصالح.
   */
  private normalizeParentId(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return isNaN(n) || n <= 0 ? null : Math.floor(n);
  }

  /**
   * يفسر قيمة منطقية قادمة من JSON أو multipart (سلاسل "true"/"false").
   *
   * @param value - القيمة الخام.
   * @returns `true` فقط للقيم الصريحة (true/1/"1"/"true").
   */
  private toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true" || value === "True";
  }


  async getLibraryGenres(libraryId: number) {
    return this.mediaRepo.getGenresForLibrary(libraryId);
  }

  async getLibraryAgeRatings(libraryId: number) {
    return this.mediaRepo.getAgeRatings(libraryId);
  }

  async refreshMediaCount(libraryId: number) {
    await this.libraryRepo.updateMediaCount(libraryId);
    return { success: true };
  }

  async validateLibrary(data: Record<string, unknown>) {
    const errors: string[] = [];

    if (!data["name"] || !(data["name"] as string).trim()) {
      errors.push("Library name is required");
    }
    if ((data["name"] as string)?.length > 200) {
      errors.push("Library name must be at most 200 characters");
    }
    const type = this.normalizeLibraryType(data["type"]);
    if (!type) {
      errors.push(`Invalid library type. Must be one of: ${ALLOWED_TYPES.join(", ")}`);
    }

    const isContainer = type === "main";
    if (type === "linked") {
      if (!this.normalizeParentId(data["linked_library_id"] ?? data["linkedLibraryId"])) {
        errors.push("A linked library requires a target section");
      }
    } else if (!isContainer) {
      const paths = this.parsePaths(data["paths"]);
      if (!paths.length) {
        errors.push("At least one path is required");
      }
      for (const p of paths) {
        try {
          await fs.access(p);
        } catch {
          errors.push(`Path does not exist: ${p}`);
        }
      }
    }

    const existing = await this.libraryRepo.findByName(data["name"] as string);
    if (existing) {
      errors.push("A library with this name already exists");
    }

    return { valid: errors.length === 0, errors };
  }

  async checkPathConflicts(paths: string[]) {
    const conflicts: string[] = [];
    const allLibs = (await this.libraryRepo.getAll()) as Record<string, unknown>[];

    for (const p of paths) {
      const normalized = this.normalizePathStr(p);
      for (const lib of allLibs) {
        const libPaths = this.parsePaths(lib["paths"]);
        for (const lp of libPaths) {
          if (this.normalizePathStr(lp) === normalized) {
            conflicts.push(`Path "${p}" is already used by library "${lib["name"]}"`);
          }
        }
      }
    }
    return conflicts;
  }

  async getLibraryStats(libraryId: number) {
    return this.libraryRepo.getDetailedStats(libraryId);
  }

  parsePaths(input: unknown): string[] {
    if (!input) return [];
    if (Array.isArray(input)) return input.map(String).filter(Boolean);
    if (typeof input !== "string") return [];
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      // not JSON
    }
    return trimmed
      .split(/[;,\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  private normalizePathStr(filePath: string): string {
    if (!filePath) return "";
    return filePath.replace(/\//g, "\\").replace(/\\\\+/g, "\\").replace(/\\$/, "").toLowerCase();
  }

  /**
   * يسجّل حدث نظام في سجل الأنشطة بأمان: أي فشل في التسجيل يُطبَع فقط ولا
   * يعطّل العملية الأصلية (إنشاء/تعديل/حذف مكتبة).
   *
   * @param action - إجراء النظام (`library_created` | `library_updated` | `library_deleted`).
   * @param details - تفاصيل العملية (معرّف المكتبة واسمها...).
   */
  private logSystemEvent(action: string, details: Record<string, unknown>): Promise<void> {
    if (!this.activityRepo) return Promise.resolve();
    return this.activityRepo
      .logActivity({
        entityType: "system",
        action,
        module: "libraries",
        severity: "success",
        details,
      })
      .catch((err: Error) => {
        console.error(`[LibraryService] Failed to log ${action}:`, err.message);
      });
  }

  private toPublicLibrary(lib: Record<string, unknown>) {
    if (!lib) return null;
    return {
      library_id: lib["library_id"],
      name: lib["name"],
      type: lib["type"],
      image: lib["image"],
      paths:
        typeof lib["paths"] === "string"
          ? (lib["paths"] as string).split(";").filter(Boolean)
          : (lib["paths"] ?? []),
      parent_id: lib["parent_id"] ?? null,
      linked_library_id: lib["linked_library_id"] ?? null,
      is_linked: lib["type"] === "linked",
      hide_section: Boolean(lib["hide_section"]),
      is_container: Boolean(lib["is_container"]) || lib["type"] === "main",
      media_count: lib["media_count"] ?? 0,
      status: lib["status"] ?? "active",
      language: lib["language"] ?? null,
      country: lib["country"] ?? null,
      created_at: lib["created_at"],
      updated_at: lib["updated_at"],
      last_scanned: lib["last_scanned"],
    };
  }




  // async deleteLibrary(libraryId: number) {
  //   const lib = await this.libraryRepo.getById(libraryId);
  //   if (!lib) throw new Error("Library not found");
  //   await this.libraryRepo.delete(libraryId);
  //   void this.logSystemEvent("library_deleted", {
  //     libraryId,
  //     name: (lib as Record<string, unknown>)["name"] ?? null,
  //   });
  //   return { success: true, message: "Library deleted" };
  // }


/**
 * يحذف مكتبة معينة بصورة نهائية مع كافة البيانات والجداول المرتبطة بها داخل معاملة (Transaction).
 * 
 * تتبع الدالة الخطوات التالية:
 * 1. التحقق من وجود المكتبة أولاً عبر الـ Repository.
 * 2. فتح معاملة قاعدة بيانات (`BEGIN TRANSACTION`) لضمان تكامل وسلامة البيانات.
 * 3. حذف البيانات التابعة بالترتيب لتفادي قيود المفاتيح الأجنبية (Foreign Key constraints):
 *    - ملفات الوسائط (`media_files`)
 *    - الأنواع/التصنيفات (`media_genres`)
 *    - الأشخاص/الممثلين (`media_people`)
 *    - تقدم المستخدمين (`user_progress`)
 *    - المفضلة (`favorites`)
 *    - البلاغات والتقارير (`media_reports`)
 *    - عناصر الوسائط نفسها (`media_items`)
 *    - سجل المكتبة من جدول المكتبات الرئيسي (`libraries`).
 * 4. تأكيد التغييرات (`COMMIT`) في حال النجاح، أو التراجع عنها بالكامل (`ROLLBACK`) في حال حدوث أي خطأ.
 * 5. تسجيل حدث النظام (`logSystemEvent`) بشكل غير متزامن للتوثيق.
 *
 * @async
 * @function deleteLibrary
 * @param {number} libraryId - المعرّف الفريد (ID) للمكتبة المراد حذفها.
 * @returns {Promise<{ success: boolean; message: string }>} كائن يحتوي على حالة العملية ورسالة التأكيد.
 * 
 * @throws {Error} يُرمى خطأ في الحالات التالية:
 * - إذا لم يتم العثور على المكتبة (`Library not found`).
 * - إذا فشل أي استعلام أثناء تنفيذ المعاملة داخل قاعدة البيانات (يتم عمل ROLLBACK تلقائياً وإعادة إلقاء الخطأ).
 */


// استبدل دالة deleteLibrary بهذا الكود:
async deleteLibrary(libraryId: number) {
    const lib = await this.libraryRepo.getById(libraryId);
    if (!lib) throw new Error("Library not found");

    const db = await getDatabase();
    await db.run("BEGIN TRANSACTION");

    try {
        // 1. حذف جميع media_files المرتبطة بالمكتبة
        await db.run(
            `DELETE FROM media_files WHERE media_id IN (SELECT media_id FROM media_items WHERE library_id = ?)`,
            [libraryId]
        );

        // 2. حذف جميع media_genres المرتبطة بالمكتبة
        await db.run(
            `DELETE FROM media_genres WHERE media_id IN (SELECT media_id FROM media_items WHERE library_id = ?)`,
            [libraryId]
        );

        // 3. حذف جميع media_people المرتبطة بالمكتبة
        await db.run(
            `DELETE FROM media_people WHERE media_id IN (SELECT media_id FROM media_items WHERE library_id = ?)`,
            [libraryId]
        );

        // 4. حذف جميع user_progress المرتبطة بالمكتبة
        await db.run(
            `DELETE FROM user_progress WHERE media_id IN (SELECT media_id FROM media_items WHERE library_id = ?)`,
            [libraryId]
        );

     

        // 6. حذف جميع media_reports المرتبطة بالمكتبة
        await db.run(
            `DELETE FROM media_reports WHERE media_id IN (SELECT media_id FROM media_items WHERE library_id = ?)`,
            [libraryId]
        );

        // 7. حذف جميع media_items المرتبطة بالمكتبة
        await db.run(
            `DELETE FROM media_items WHERE library_id = ?`,
            [libraryId]
        );

        // 8. أخيراً، حذف المكتبة نفسها
        await this.libraryRepo.delete(libraryId);

        await db.run("COMMIT");
    } catch (err) {
        await db.run("ROLLBACK");
        throw err;
    }

    // تسجيل حدث الحذف
    void this.logSystemEvent("library_deleted", {
        libraryId,
        name: (lib as Record<string, unknown>)["name"] ?? null,
    });

    return { success: true, message: "Library deleted" };
}









}
