/**
 * اختبار تراجعي يضمن وصول التصنيفات (`genres`) مع كل بطاقة ميديا من استعلامات
 * قوائم `MediaRepository`.
 *
 * الخلفية — الخطأ الحقيقي: كانت استعلامات القوائم ترجع `SELECT m.*` من
 * `media_items` دون تجميع `media_genres`، فكان `item.genres` غير موجود
 * (`undefined`) وتفشل بطاقات الواجهة في عرض التصنيفات عند التمرير
 * (`extractGenres` تعيد `[]`). فلتر المكتبة كان يعمل فقط لأنه مسار منفصل
 * (`getGenresForLibrary`).
 *
 * الغاية: التأكد أن كل استعلام قائمة (الأحدث/المكتبة/دفعة/المثبّتة/المقترحات/
 * أعمال شخص/الفلاتر) يرفق حقل `genres` كنص JSON array صالح يتحمّله
 * `JSON.parse` — كما تفعل `extractGenres` في الواجهة — وأن العناصر بلا
 * تصنيفات تعود بـ`[]` بدل `NULL`.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDatabase, closeDatabase } from "@/backend/db/db";
import { MediaRepository } from "@/backend/repositories/media-repository";

let db: Awaited<ReturnType<typeof getDatabase>>;
let repo: MediaRepository;

beforeAll(async () => {
  db = await getDatabase();
  repo = new MediaRepository();
});

afterAll(async () => {
  await closeDatabase();
});

/** يُدرج مكتبة تجريبية ويعيد معرّفها. */
async function insertLibrary(name: string): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.run(
    "INSERT INTO libraries (name, type, created_at, updated_at) VALUES (?, 'movie', ?, ?)",
    [name, now, now],
  );
  return Number(result.lastID);
}

/** يُدرج عنصر ميديا تجريبياً ويعيد معرّفه. */
async function insertMedia(libraryId: number, title: string, isPinned = false): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO media_items (library_id, title, type, is_pinned, is_available, created_at, updated_at)
     VALUES (?, ?, 'movie', ?, 1, ?, ?)`,
    [libraryId, title, isPinned ? 1 : 0, now, now],
  );
  return Number(result.lastID);
}

/** يربط تصنيفاً بعنصر ميديا. */
async function insertGenre(mediaId: number, genre: string): Promise<void> {
  await db.run("INSERT INTO media_genres (media_id, genre) VALUES (?, ?)", [mediaId, genre]);
}

/** يربط ممثلاً بعنصر ميديا (`media_people`) لأعمال الشخص. */
async function insertPersonLink(mediaId: number, personId: number, name: string): Promise<void> {
  await db.run(
    "INSERT INTO media_people (media_id, name, role, person_id) VALUES (?, ?, 'actor', ?)",
    [mediaId, name, personId],
  );
}

/** يحلّل حقل `genres` النصي إلى مصفوفة (نفس مسار `extractGenres`). */
function parseGenres(value: unknown): string[] {
  return typeof value === "string" ? (JSON.parse(value) as string[]) : [];
}

/** يبحث عن صف بمعرّف محدد داخل مصفوفة نتائج ويحلّل تصنيفاته. */
function genresOf(rows: Array<{ media_id: number; genres?: unknown }>, mediaId: number): string[] {
  const row = rows.find((r) => r.media_id === mediaId);
  expect(row, "العنصر غير موجود في نتائج الاستعلام").toBeDefined();
  return parseGenres(row!.genres);
}

describe("MediaRepository — تصنيفات الوسائط في استعلامات القوائم", () => {
  it("getLatestMedia يرفق التصنيفات كنص JSON صالح", async () => {
    const libraryId = await insertLibrary("قوائم-أحدث");
    const movieId = await insertMedia(libraryId, "فيلم أحدث");
    await insertGenre(movieId, "أكشن");
    await insertGenre(movieId, "دراما");

    const rows = (await repo.getLatestMedia("movie", 100)) as Array<{
      media_id: number;
      genres?: unknown;
    }>;

    expect(genresOf(rows, movieId)).toEqual(["أكشن", "دراما"]);
  });

  it("getLibraryMediaFiltered يرفق التصنيفات مع دعم التصفية حسب التصنيف", async () => {
    const libraryId = await insertLibrary("قوائم-مكتبة");
    const actionId = await insertMedia(libraryId, "فيلم أكشن");
    await insertGenre(actionId, "أكشن");
    const dramaId = await insertMedia(libraryId, "فيلم دراما");
    await insertGenre(dramaId, "دراما");

    const all = (await repo.getLibraryMediaFiltered(libraryId, { rootOnly: true })) as {
      items: Array<{ media_id: number; genres?: unknown }>;
    };
    expect(genresOf(all.items, actionId)).toEqual(["أكشن"]);
    expect(genresOf(all.items, dramaId)).toEqual(["دراما"]);

    const filtered = (await repo.getLibraryMediaFiltered(libraryId, {
      rootOnly: true,
      genre: "أكشن",
    })) as { items: Array<{ media_id: number }> };
    expect(filtered.items.map((i) => i.media_id)).toContain(actionId);
    expect(filtered.items.map((i) => i.media_id)).not.toContain(dramaId);
  });

  it("batchGetByIds يرفق التصنيفات عند جلب عناصر متعددة", async () => {
    const libraryId = await insertLibrary("قوائم-دفعة");
    const movieId = await insertMedia(libraryId, "فيلم دفعة");
    await insertGenre(movieId, "رعب");

    const rows = (await repo.batchGetByIds([movieId])) as Array<{
      media_id: number;
      genres?: unknown;
    }>;

    expect(genresOf(rows, movieId)).toEqual(["رعب"]);
  });

  it("getPinnedItems يرفق التصنيفات للعناصر المثبّتة", async () => {
    const libraryId = await insertLibrary("قوائم-مثبتة");
    const pinnedId = await insertMedia(libraryId, "فيلم مثبت", true);
    await insertGenre(pinnedId, "كوميديا");

    const rows = (await repo.getPinnedItems()) as Array<{
      media_id: number;
      genres?: unknown;
    }>;

    expect(genresOf(rows, pinnedId)).toEqual(["كوميديا"]);
  });

  it("getRecommendations يرفق التصنيفات للعناصر المقترحة", async () => {
    const libraryId = await insertLibrary("قوائم-مقترحات");
    const targetId = await insertMedia(libraryId, "فيلم مقترحات-أساس");
    const suggestedId = await insertMedia(libraryId, "فيلم مقترحات-مقترح");
    await insertGenre(suggestedId, "خيال علمي");

    const rows = (await repo.getRecommendations(targetId, libraryId, "movie", 100)) as Array<{
      media_id: number;
      genres?: unknown;
    }>;

    expect(genresOf(rows, suggestedId)).toEqual(["خيال علمي"]);
  });

  it("getPersonWorks يرفق التصنيفات لأعمال الشخص", async () => {
    const libraryId = await insertLibrary("قوائم-أشخاص");
    const workId = await insertMedia(libraryId, "فيلم أعمال شخص");
    await insertGenre(workId, "مغامرة");
    await insertPersonLink(workId, 90001, "ممثل تجريبي");

    const rows = (await repo.getPersonWorks(90001)) as Array<{
      media_id: number;
      genres?: unknown;
    }>;

    expect(genresOf(rows, workId)).toEqual(["مغامرة"]);
  });

  it("getMediaByFilter يرفق التصنيفات في نتائج فلتر الوسائط", async () => {
    const libraryId = await insertLibrary("قوائم-فلتر");
    const movieId = await insertMedia(libraryId, "فيلم فلتر");
    await insertGenre(movieId, "وثائقي");

    const result = (await repo.getMediaByFilter({ libraryId, rootOnly: true })) as {
      items: Array<{ media_id: number; genres?: unknown }>;
    };

    expect(genresOf(result.items, movieId)).toEqual(["وثائقي"]);
  });

  it("العناصر بلا تصنيفات تعود بـ[] بدل NULL حتى يظل JSON.parse آمناً", async () => {
    const libraryId = await insertLibrary("قوائم-بلا تصنيفات");
    const bareId = await insertMedia(libraryId, "فيلم بلا تصنيفات");

    const rows = (await repo.getLatestMedia("movie", 100)) as Array<{
      media_id: number;
      genres?: unknown;
    }>;

    expect(genresOf(rows, bareId)).toEqual([]);
  });
});
