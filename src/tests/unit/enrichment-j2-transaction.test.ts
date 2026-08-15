/**
 * اختبارات J2 من تدقيق metadata-enrichment-deep-audit.md:
 * ذرّية الإثراء + حارس العنصر الواحد + مزامنة فهرس البحث FTS5.
 *
 * 1) كل كتابات الإثراء (update + refreshEnrichmentStatus + saveGenres +
 *    savePeople + saveProductionCompanies + updateCreditsSyncTime) تُنفَّذ داخل
 *    `runInWriterContext` + `withTransaction` (SAVEPOINT): أي فشل في منتصف
 *    العملية يسترجع كامل الحالة السابقة بدل ترك حالة جزئية.
 * 2) حارس `inFlightItems` يمنع إثراء العنصر نفسه بالتوازي.
 * 3) بعد نجاح الإثراء/إعادة الضبط يُعاد توليف صف `media_search` عبر
 *    `searchRepo.addToIndex` كي تنعكس الأصناف والطاقم الجديدة على البحث.
 *
 * يُستخدم مسار `tmdbId` (تجاوز البحث) لمرور كامل، وتُستبدل طريقة
 * `_fetchFromTmdb` فقط؛ أما `_applyEnrichmentFromDetails` فتبقى حقيقية وتعمل
 * على قاعدة بيانات حقيقية في الذاكرة (مشتركة بين اتصالي القراءة والكتابة
 * عبر `SHARED_MEMORY_URI` في db.ts).
 */
import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from "vitest";
import { getDatabase, closeDatabase } from "@/backend/db/db";
import { TmdbEnrichmentService } from "@/backend/services/tmdb-enrichment-service";
import { MediaRepository } from "@/backend/repositories/media-repository";
import { EnrichmentMediaRepository } from "@/backend/repositories/enrichment-media-repository";
import { LibraryRepository } from "@/backend/repositories/library-repository";
import { EnrichmentApprovalRepository } from "@/backend/repositories/enrichment-repository";
import { SearchRepository } from "@/backend/repositories/search-repository";

let db: Awaited<ReturnType<typeof getDatabase>>;
let enrichmentRepo: EnrichmentMediaRepository;
let mediaRepo: MediaRepository;
let searchRepo: SearchRepository;

beforeAll(async () => {
  db = await getDatabase();
  enrichmentRepo = new EnrichmentMediaRepository();
  mediaRepo = new MediaRepository();
  searchRepo = new SearchRepository();
});

afterAll(async () => {
  await closeDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * يدرج عنصر وسائط حقيقياً في قاعدة الذاكرة ويعيد معرّفه.
 *
 * @param title - عنوان العنصر.
 * @returns `media_id` للصف المُدرج.
 */
async function seedMediaItem(title: string): Promise<number> {
  const result = await db.run(
    `INSERT INTO media_items (title, type, is_available, created_at) VALUES (?, 'movie', 1, datetime('now'))`,
    [title],
  );
  if (!result.lastID) throw new Error("Failed to seed media item");
  return result.lastID;
}

/**
 * يعيد كائن تفاصيل TMDB كاملاً يصلح لمسار النجاح (يُعاد لكل من ar و en).
 *
 * @returns تفاصيل مع genres وcredits وproduction_companies وposter/backdrop فارغة
 *          (حتى لا يُحاول الإثراء تحميل صور أثناء الاختبار).
 */
function fullDetails(): Record<string, unknown> {
  return {
    id: 555,
    overview: "A gripping Arabic drama.",
    original_title: "التجربة",
    original_name: "التجربة",
    tagline: "Tagline",
    vote_average: 8.2,
    vote_count: 1200,
    runtime: 120,
    release_date: "2021-05-01",
    production_countries: [{ iso_3166_1: "EG" }],
    origin_country: ["EG"],
    poster_path: null,
    backdrop_path: null,
    genres: [{ name: "Drama" }, { name: "Crime" }],
    credits: {
      cast: [
        { id: 1, name: "Actor One", character: "Role", profile_path: null, order: 0 },
        { id: 2, name: "Actor Two", character: null, profile_path: null, order: 1 },
      ],
      crew: [
        { id: 3, name: "Director D", job: "Director", department: "Directing", profile_path: null },
      ],
    },
    production_companies: [{ name: "Studio X" }],
  };
}

/**
 * يبني خدمة إثراء حقيقية (مستودعات حقيقية) مع استبدال `_fetchFromTmdb` فقط.
 *
 * @param fetchImpl - بديل لـ `_fetchFromTmdb` (افتراضياً يُعيد `fullDetails`).
 * @returns نسخة جاهزة من `TmdbEnrichmentService`.
 */
function buildService(fetchImpl?: () => Promise<Record<string, unknown>>): TmdbEnrichmentService {
  const service = new TmdbEnrichmentService(
    enrichmentRepo,
    mediaRepo,
    new LibraryRepository(),
    new EnrichmentApprovalRepository(),
    searchRepo,
    "test-api-key",
  );
  (
    service as unknown as { _fetchFromTmdb: () => Promise<Record<string, unknown>> }
  )._fetchFromTmdb = fetchImpl ?? (async () => fullDetails());
  return service;
}

describe("J2: ذرّية الإثراء ومزامنة فهرس البحث FTS5", () => {
  it("ينجح الإثراء ويكتب فعلياً ثم يزامن فهرس البحث بالأصناف والطاقم", async () => {
    const mediaId = await seedMediaItem("فيلم تجريبي للبحث");
    const service = buildService();

    const result = await service.enrichItem(mediaId, { tmdbId: 555, force: true });
    expect(result.success).toBe(true);

    const row = (await db.get(
      "SELECT tmdb_id, original_title, metadata_source, credits_last_sync FROM media_items WHERE media_id = ?",
      [mediaId],
    )) as Record<string, unknown>;
    expect(row.tmdb_id).toBe(555);
    expect(row.original_title).toBe("التجربة");
    expect(row.metadata_source).toBe("tmdb");
    expect(row.credits_last_sync).not.toBeNull();

    const genres = (await db.get(
      "SELECT GROUP_CONCAT(genre) as g FROM media_genres WHERE media_id = ?",
      [mediaId],
    )) as { g: string | null };
    expect(genres.g).toContain("دراما");
    expect(genres.g).toContain("جريمة");

    const idxRows = (await db.all("SELECT genres, cast_names FROM media_search WHERE title = ?", [
      "فيلم تجريبي للبحث",
    ])) as Array<{ genres: string | null; cast_names: string | null }>;
    expect(idxRows.length).toBeGreaterThan(0);
    expect(idxRows.some((r) => (r.genres ?? "").includes("دراما"))).toBe(true);
    expect(idxRows.some((r) => (r.genres ?? "").includes("جريمة"))).toBe(true);
    expect(idxRows.some((r) => (r.cast_names ?? "").includes("Actor One"))).toBe(true);
    expect(idxRows.some((r) => (r.cast_names ?? "").includes("Director D"))).toBe(true);
  });

  it("فشل في منتصف المعاملة يسترجع كل الكتابات (لا حالة جزئية)", async () => {
    const mediaId = await seedMediaItem("فيلم الفشل الذري");
    vi.spyOn(enrichmentRepo, "saveGenres").mockRejectedValueOnce(new Error("boom"));

    const service = buildService();
    const result = await service.enrichItem(mediaId, { tmdbId: 555, force: true });

    expect(result.success).toBe(false);

    const row = (await db.get(
      "SELECT tmdb_id, metadata_source FROM media_items WHERE media_id = ?",
      [mediaId],
    )) as Record<string, unknown>;
    expect(row.tmdb_id).toBeNull();
    expect(row.metadata_source).toBeNull();

    const genres = (await db.get("SELECT COUNT(*) as c FROM media_genres WHERE media_id = ?", [
      mediaId,
    ])) as { c: number };
    expect(genres.c).toBe(0);

    const people = (await db.get("SELECT COUNT(*) as c FROM media_people WHERE media_id = ?", [
      mediaId,
    ])) as { c: number };
    expect(people.c).toBe(0);

    const idxRows = (await db.all("SELECT genres, cast_names FROM media_search WHERE title = ?", [
      "فيلم الفشل الذري",
    ])) as Array<{ genres: string | null; cast_names: string | null }>;
    expect(idxRows.some((r) => (r.genres ?? "") !== "")).toBe(false);
    expect(idxRows.some((r) => (r.cast_names ?? "") !== "")).toBe(false);
  });

  it("resetItemMetadata يمسح الإثراء ويعيد توليف صف الفهرس بدون أنقاض", async () => {
    const mediaId = await seedMediaItem("فيلم إعادة الضبط");
    const service = buildService();

    const enriched = await service.enrichItem(mediaId, { tmdbId: 555, force: true });
    expect(enriched.success).toBe(true);

    const reset = await service.resetItemMetadata(mediaId);
    expect(reset.success).toBe(true);

    const genres = (await db.get("SELECT COUNT(*) as c FROM media_genres WHERE media_id = ?", [
      mediaId,
    ])) as { c: number };
    expect(genres.c).toBe(0);

    const idxRows = (await db.all("SELECT genres, cast_names FROM media_search WHERE title = ?", [
      "فيلم إعادة الضبط",
    ])) as Array<{ genres: string | null; cast_names: string | null }>;
    expect(idxRows.length).toBeGreaterThan(0);
    expect(idxRows.every((r) => (r.genres ?? "") === "")).toBe(true);
    expect(idxRows.every((r) => (r.cast_names ?? "") === "")).toBe(true);
  });
});

describe("J2: حارس العنصر الواحد في enrichItem", () => {
  it("يمنع إثراء العنصر نفسه بالتوازي ويحرّر الحارس بعد الانتهاء", async () => {
    const mediaId = await seedMediaItem("فيلم الحارس");

    let releaseFetch!: (v: Record<string, unknown>) => void;
    const gate = new Promise<Record<string, unknown>>((resolve) => {
      releaseFetch = resolve;
    });

    const service = buildService(() => gate);

    const first = service.enrichItem(mediaId, { tmdbId: 555, force: true });
    const second = await service.enrichItem(mediaId, { tmdbId: 555, force: true });

    expect(second).toMatchObject({ success: false, inProgress: true });

    releaseFetch(fullDetails());
    const firstResult = await first;
    expect(firstResult.success).toBe(true);

    const after = await service.enrichItem(mediaId, { tmdbId: 555, force: true });
    expect(after).toMatchObject({ success: true });
    expect(after.inProgress).toBeUndefined();
  });
});
