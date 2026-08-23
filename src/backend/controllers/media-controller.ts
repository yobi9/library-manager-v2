import { BaseController, type RequestContext } from "./base-controller";
import type { MediaService } from "../services/media-service";
import type { ViewService, ViewerContext } from "../services/view-service";
import type { AuthContext } from "../api/route-helpers";
import { MediaListCursorError } from "../repositories/media-repository";

export class MediaController extends BaseController {
  constructor(
    private mediaService: MediaService,
    private viewService: ViewService,
  ) {
    super();
  }

  async getMediaById(id: string, auth?: AuthContext) {
    try {
      const mediaId = this.parseId(id);
      const media = await this.mediaService.getMediaById(mediaId, auth);
      if (!media) return this.notFound("Media not found");
      return this.ok(media);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getLatest(type?: string, limitStr?: string, auth?: AuthContext) {
    try {
      const limit = this.parseLimit(limitStr, 24);
      const items = await this.mediaService.getLatestItems(type, limit, auth);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * GET قائمة وسائط مكتبة — يبني خيارات الاستعلام من معاملات الطلب ويفوّض الخدمة.
   * يدعم وضعي ترقيم: `cursor` (keyset، المفضل للتمرير اللانهائي) و`offset`
   * (التوافق القديم). مؤشر تالف أو غير مطابق للترتيب ⇒ 400 برسالة عربية.
   *
   * @param libraryId - معرّف المكتبة نصياً كما ورد في المسار.
   * @param params - معاملات query الخام (rootOnly/sortBy/sortOrder/limit/offset/cursor/فلاتر).
   * @param auth - سياق المصادقة الاختياري لتطبيق التصنيفات المحظورة.
   * @returns ControllerResult ببيانات القائمة أو خطأ مهيأ.
   */
  async getLibraryMedia(libraryId: string, params: Record<string, string>, auth?: AuthContext) {
    try {
      const id = this.parseId(libraryId);
      const result = await this.mediaService.getLibraryMedia(id, {
        rootOnly: params["rootOnly"] === "true",
        sortBy: params["sortBy"],
        sortOrder: params["sortOrder"],
        limit: this.parseLimit(params["limit"], 50),
        offset: this.parsePage(params["offset"], 0),
        cursor: params["cursor"] || undefined,
        year: params["year"],
        genre: params["genre"],
        certification: params["certification"],
        search: params["search"],
      }, auth);
      return this.ok(result);
    } catch (err) {
      if (err instanceof MediaListCursorError) return this.error(err.message, 400);
      return this.handleError(err);
    }
  }

  async getMediaBatch(idsParam: string, auth?: AuthContext) {
    try {
      if (!idsParam) return this.error("ids parameter required");
      const ids = idsParam.split(",").map(Number).filter(Boolean);
      const items = await this.mediaService.getMediaBatch(ids, auth);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getMediaByFilter(params: Record<string, string>, auth?: AuthContext) {
    try {
      const filterBy = params["filterBy"] as
        "all" | "pinned" | "no-content" | "needs-review" | undefined;
      const result = await this.mediaService.getMediaByFilter({
        year: params["year"] ? Number(params["year"]) : undefined,
        genre: params["genre"],
        certification: params["certification"],
        minRating: params["minRating"] ? Number(params["minRating"]) : undefined,
        search: params["search"] || undefined,
        libraryId: params["libraryId"] ? Number(params["libraryId"]) : undefined,
        type: params["type"] || undefined,
        filterBy: filterBy && filterBy !== "all" ? filterBy : "all",
        rootOnly: params["rootOnly"] === "true",
        excludeTypes: params["excludeTypes"]
          ? params["excludeTypes"]
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
        page: this.parsePage(params["page"], 1),
        limit: this.parseLimit(params["limit"], 30),
      }, auth);

      if (params["admin"] === "true") {
        const stats = await this.mediaService.getAdminStats();
        return this.ok({ ...result, stats });
      }
      return this.ok(result);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getPinnedItems(auth?: AuthContext) {
    try {
      const items = await this.mediaService.getPinnedItems(auth);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getAllGenres() {
    try {
      const genres = await this.mediaService.getAllGenres();
      return this.ok(genres);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getMediaTypes() {
    try {
      const types = await this.mediaService.getMediaTypes();
      return this.ok(types);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async togglePin(id: string) {
    try {
      const mediaId = this.parseId(id);
      const newState = await this.mediaService.togglePin(mediaId);
      return this.ok({ pinned: newState === 1 });
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * يسجّل مشاهدة عنصر وسائط: يرفع عداد `views` ويسجّل صف `view_media`
   * في `activities` ويبث حدث `user_view`/`visitor_view` عبر SSE (بسقف 10 دقائق
   * لكل مشاهد). يشترط وجود عنوان؛ إن غاب لا يُعدّ أي شيء.
   *
   * @param viewer - سياق المشاهد (مستخدم/زائر + هيدرز) المُبنى في مسار الـ API.
   * @param id - معرّف العنصر كنص يُحلّل إلى رقم صحيح.
   * @returns `{ success: true }` دائماً — الفشل الصامت مقصود حتى لا يكسر التشغيل.
   */
  async incrementView(viewer: ViewerContext, id: string) {
    try {
      const mediaId = this.parseId(id);
      const title = await this.mediaService.getMediaTitle(mediaId);
      this.viewService.trackMediaView(viewer, mediaId, title);
      return this.ok({ success: true });
    } catch (err) {
      return this.handleError(err);
    }
  }

  async checkPlayable(id: string, auth?: AuthContext) {
    try {
      const mediaId = this.parseId(id);
      const info = await this.mediaService.getStreamInfo(mediaId, auth);
      if (!info) return this.ok({ playable: false });
      return this.ok({
        playable: true,
        media_id: info.media_id,
        file_size: info.file_size,
        mime_type: info.mime_type,
        duration: info.duration,
        title: info.title,
      });
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getStreamTarget(id: string, auth?: AuthContext) {
    try {
      const mediaId = this.parseId(id);
      const info = await this.mediaService.getStreamInfo(mediaId, auth);
      if (!info) return this.notFound("Video file not found");
      return this.ok(info);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteItem(id: string) {
    try {
      const mediaId = this.parseId(id);
      await this.mediaService.deleteItem(mediaId);
      return this.ok(null, "Media deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateMedia(id: string, updates: Record<string, unknown>) {
    try {
      const mediaId = this.parseId(id);
      const updated = await this.mediaService.updateMedia(mediaId, updates);
      return this.ok(updated, "Media updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getRecommendations(id: string, type: string, limitStr?: string, auth?: AuthContext) {
    try {
      const mediaId = this.parseId(id);
      const limit = this.parseLimit(limitStr, 20);
      const media = await this.mediaService.getMediaById(mediaId, auth);
      const libraryId = (media as Record<string, unknown>)?.["library_id"] as number;
      const mediaType = (media as Record<string, unknown>)?.["type"] as string | undefined;
      const items = await this.mediaService.getRecommendations(
        mediaId,
        libraryId,
        type === "all" ? undefined : mediaType,
        limit,
        auth,
      );
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getAvailableYears(libraryIdStr?: string) {
    try {
      const libraryId = libraryIdStr ? Number(libraryIdStr) : undefined;
      const years = await this.mediaService.getAvailableYears(libraryId);
      return this.ok(years);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getAllCertifications() {
    try {
      const certifications = await this.mediaService.getAllCertifications();
      return this.ok(certifications);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getRatingBuckets() {
    try {
      const buckets = await this.mediaService.getRatingBuckets();
      return this.ok(buckets);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getAllPeople(limitStr?: string, search?: string) {
    try {
      const limit = this.parseLimit(limitStr, 100);
      const people = await this.mediaService.getAllPeople(limit, search);
      return this.ok(people);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getPerson(id: string) {
    try {
      const personId = this.parseId(id);
      const person = await this.mediaService.getPerson(personId);
      if (!person) return this.notFound("Person not found");
      return this.ok(person);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getPersonWorks(id: string, auth?: AuthContext) {
    try {
      const personId = this.parseId(id);
      const works = await this.mediaService.getPersonWorks(personId, auth);
      return this.ok(works);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getMediaChildren(parentId: string, auth?: AuthContext) {
    try {
      const id = this.parseId(parentId);
      const items = await this.mediaService.getMediaChildren(id, auth);
      return this.ok(items);
    } catch (err) {
      return this.handleError(err);
    }
  }
}
