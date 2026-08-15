import { getEventBus } from "./event-bus";
import { runInWriterContext } from "../db/db";
import { MediaRepository } from "../repositories/media-repository";
import { EnrichmentMediaRepository } from "../repositories/enrichment-media-repository";
import { SearchRepository } from "../repositories/search-repository";
import { ActivityRepository } from "../repositories/activity-repository";

/** A row of the media_people table as accepted/serialized by the manual metadata update flow. */
export interface MetadataPersonRow {
  person_id: number | null;
  name: string;
  role: string;
  character: string | null;
  department: string | null;
  profile_path: string | null;
  importance_order: number;
}

export class MetadataService {
  /**
   * يبني الخدمة مع مستودعاتها واعتمادياتها.
   *
   * @param mediaRepo - مستودع عناصر الوسائط (التحديثات وحالة الإثراء).
   * @param enrichmentRepo - مستودع بيانات الإثراء (الأصناف والطاقم).
   * @param searchRepo - مستودع فهرس البحث FTS5 (لمزامنة `media_search` بعد التعديل اليدوي).
   * @param activityRepo - مستودع سجل الأنشطة (اختياري).
   */
  constructor(
    private mediaRepo: MediaRepository,
    private enrichmentRepo: EnrichmentMediaRepository,
    private searchRepo: SearchRepository,
    private activityRepo?: ActivityRepository,
  ) {}

  /**
   * Applies manual metadata edits to a media item (the admin edit form).
   *
   * Updates scalar columns (title, original_title, overview, runtime, year/release_date,
   * imdb_rating, imdb_votes, certification, tmdb_id, country, language, poster/backdrop paths,
   * type, is_pinned, is_available), then replaces genres (via `tags`) and the full people list.
   * When `data.people` is provided it is saved verbatim (preserving every crew role);
   * otherwise the legacy `cast`/`directors`/`writers` arrays are converted to rows.
   *
   * @param mediaId - ID of the media item to update.
   * @param data - Edit payload from the admin form.
   * @returns `{ success: true, message }` or `{ success: false, error, statusCode, existingId, existingTitle }`
   *          when the new title duplicates an existing title in the same library.
   *
   * تُنفَّذ كل الكتابات (التحديث + الأصناف + الطاقم) داخل `runInWriterContext`
   * و `withTransaction` (SAVEPOINT) كي تكون العملية ذرّية، ثم يُعاد توليف صف
   * `media_search` عبر `addToIndex` حتى تنعكس الأصناف والطاقم الجديدة على
   * فهرس البحث فوراً.
   */
  async updateMetadataManually(
    mediaId: number,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const updatePayload: Record<string, unknown> = {
      title: data.title,
      overview: data.overview,
      overview_ar: data.overview_ar,
      overview_en: data.overview_en,
      runtime: data.runtime ? Number(data.runtime) : null,
      year: data.release_date
        ? new Date(data.release_date as string).getFullYear()
        : data.year || null,
      release_date: data.release_date ? String(data.release_date) : null,
      imdb_rating: data.imdb_rating ? Number(data.imdb_rating) : null,
      imdb_votes: data.imdb_votes ? Number(data.imdb_votes) : null,
      certification: data.certification || null,
      tmdb_id: data.tmdb_id || null,
      country: data.country ?? null,
      language: data.language ?? null,
      metadata_status: "completed",
      metadata_source: "manual",
      last_metadata_sync: new Date().toISOString(),
    };

    if (data.original_title !== undefined)
      updatePayload.original_title = (data.original_title as string) || null;
    if (data.poster_path !== undefined)
      updatePayload.poster_path = (data.poster_path as string) || null;
    if (data.backdrop_path !== undefined)
      updatePayload.backdrop_path = (data.backdrop_path as string) || null;
    if (data.type !== undefined) updatePayload.type = (data.type as string) || null;
    if (data.is_pinned !== undefined) updatePayload.is_pinned = data.is_pinned ? 1 : 0;
    if (data.is_available !== undefined) updatePayload.is_available = data.is_available ? 1 : 0;

    Object.keys(updatePayload).forEach(
      (k) => updatePayload[k] === undefined && delete updatePayload[k],
    );

    const before = (await this.mediaRepo.getById(mediaId)) as Record<string, unknown> | null;

    if (data.title && before && data.title !== before.title && before.library_id) {
      const duplicates = await this.mediaRepo.checkDuplicateTitle(
        mediaId,
        data.title as string,
        before.library_id as number,
      );
      if (duplicates.length > 0 && duplicates[0]) {
        return {
          success: false,
          error: "عنصر بنفس الاسم موجود مسبقاً في هذه المكتبة",
          existingId: duplicates[0].media_id,
          existingTitle: duplicates[0].title,
          statusCode: 409,
        };
      }
    }

    await runInWriterContext(async () => {
      await this.enrichmentRepo.withTransaction(async () => {
        await this.mediaRepo.update(mediaId, updatePayload);
        await this.mediaRepo.refreshEnrichmentStatus(mediaId);

        if (Array.isArray(data.tags))
          await this.enrichmentRepo.saveGenres(
            mediaId,
            (data.tags as string[]).map((t) => t.trim()),
          );

        if (Array.isArray(data.people)) {
          const people = data.people.filter(
            (p): p is MetadataPersonRow =>
              !!p &&
              typeof p === "object" &&
              typeof (p as Record<string, unknown>).name === "string",
          );
          await this.enrichmentRepo.savePeople(mediaId, people);
        } else {
          await this.enrichmentRepo.savePeople(mediaId, this._buildPeopleFromLegacy(data));
        }
      });
      await this.searchRepo.addToIndex(mediaId);
    });

    getEventBus().emit("media:changed", { id: mediaId });
    this._logSystemEvent("metadata_manual_edit", {
      mediaId,
      title: (data.title as string) ?? null,
    });
    return { success: true, message: "تم تحديث البيانات بنجاح" };
  }

  /**
   * يسجّل تعديل بيانات يدوياً في سجل الأنشطة بأمان: أي فشل في التسجيل يُطبَع
   * فقط ولا يعطّل العملية الأصلية.
   *
   * @param action - إجراء النظام (`metadata_manual_edit`).
   * @param details - تفاصيل العملية (معرّف العنصر وعنوانه).
   */
  private _logSystemEvent(action: string, details: Record<string, unknown>): void {
    if (!this.activityRepo) return;
    void this.activityRepo
      .logActivity({
        entityType: "system",
        action,
        module: "metadata",
        severity: "info",
        details,
      })
      .catch((err: Error) => {
        console.error(`[MetadataService] Failed to log ${action}:`, err.message);
      });
  }

  /**
   * Converts the legacy `cast`/`directors`/`writers` arrays of strings or objects into media_people rows.
   *
   * @param data - Payload with optional `cast`, `directors` and `writers` arrays.
   * @returns Array of normalized person rows.
   */
  private _buildPeopleFromLegacy(data: Record<string, unknown>): MetadataPersonRow[] {
    const allPeople: MetadataPersonRow[] = [];

    if (Array.isArray(data.cast)) {
      data.cast.forEach((item: unknown, idx: number) => {
        if (typeof item === "string") {
          const n = item.trim();
          if (!n) return;
          allPeople.push({
            person_id: null,
            name: n,
            role: "Actor",
            character: "",
            department: "Acting",
            profile_path: null,
            importance_order: idx,
          });
        } else if (item && typeof item === "object") {
          const itemObj = item as Record<string, unknown>;
          const n = ((itemObj.name as string) || "").trim();
          if (!n) return;
          allPeople.push({
            person_id: (itemObj.person_id as number) || null,
            name: n,
            role: "Actor",
            character: (itemObj.character as string) || "",
            department: "Acting",
            profile_path: (itemObj.profile_path as string) || null,
            importance_order: (itemObj.order as number) ?? idx,
          });
        }
      });
    }

    for (const role of ["directors", "writers"]) {
      const items = data[role] as Array<unknown> | undefined;
      if (!items) continue;
      items.forEach((item: unknown) => {
        if (typeof item === "string") {
          const n = item.trim();
          if (!n) return;
          allPeople.push({
            person_id: null,
            name: n,
            role: role === "directors" ? "Director" : "Writer",
            character: null,
            department: role === "directors" ? "Directing" : "Writing",
            profile_path: null,
            importance_order: 0,
          });
        } else if (item && typeof item === "object") {
          const itemObj = item as Record<string, unknown>;
          const n = ((itemObj.name as string) || "").trim();
          if (!n) return;
          allPeople.push({
            person_id: (itemObj.person_id as number) || null,
            name: n,
            role: role === "directors" ? "Director" : "Writer",
            character: null,
            department: role === "directors" ? "Directing" : "Writing",
            profile_path: (itemObj.profile_path as string) || null,
            importance_order: (itemObj.order as number) || 0,
          });
        }
      });
    }

    return allPeople;
  }

  private _collectNames(data: Record<string, unknown>): string[] {
    const names: string[] = [];
    for (const key of ["cast", "directors", "writers"]) {
      const items = data[key] as Array<unknown> | undefined;
      if (!items) continue;
      for (const item of items) {
        if (typeof item === "string") names.push(item.trim());
        else if (item && typeof item === "object") {
          const n = (((item as Record<string, unknown>).name as string) || "").trim();
          if (n) names.push(n);
        }
      }
    }
    return names;
  }
}
