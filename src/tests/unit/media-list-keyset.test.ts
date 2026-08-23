/**
 * اختبارات ترقيم keyset (المؤشر) لقائمة وسائط المكتبة في `MediaRepository`.
 *
 * الخلفية — الخطأ الحقيقي: كان التمرير اللانهائي يعتمد OFFSET فوق بيانات
 * متغيرة؛ إدراج صفوف أثناء مسح نشط يُنزح نوافذ OFFSET فيعود تسليم عناصر
 * محمَّلة سابقاً (تكرارات مرئية وتحذيرات React keys) وتُتخطى عناصر أخرى
 * (فراغات). الدليل الحي: قفزة total من 2623 إلى 2648 أثناء تمرير أنتجت
 * كتلة مفاتيح مكررة 106510–106521.
 *
 * الغاية: ضمان أن المسند `(مفتاح الفرز, media_id)` مع المؤشر المعتم يجعل
 * جلب الصفحات محصّناً ضد الإدراج المتزامن — لا تكرار ولا فراغ مهما تغيّر
 * الجدول بين الصفحات — وأن المؤشر التالف أو غير المطابق للترتيب يُرفض،
 * وأن كسر التعادل بـmedia_id يجعل الترتيب حتمياً عند تساوي المفاتيح.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDatabase, closeDatabase } from "@/backend/db/db";
import { MediaRepository, MediaListCursorError } from "@/backend/repositories/media-repository";

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

/**
 * يُدرج عنصر ميديا تجريبياً ويعيد معرّفه.
 *
 * @param libraryId - معرف المكتبة.
 * @param title - عنوان العنصر.
 * @param createdAt - تاريخ الإنشاء؛ تمرير `undefined` يُنتج created_at=NULL عمداً.
 */
async function insertRow(libraryId: number, title: string, createdAt?: string): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO media_items (library_id, title, type, is_available, created_at, updated_at)
     VALUES (?, ?, 'movie', 1, ?, ?)`,
    [libraryId, title, createdAt ?? null, createdAt ?? now],
  );
  return Number(result.lastID);
}

/** خيارات استعلام موحدة للوضع الحديث: rootOnly + حجم صفحة صغير. */
const PAGE = { rootOnly: true, limit: 5 };

/** شكل صفحة النتائج كما تستهلكه هذه الاختبارات (صفوف مختصرة بالمعرف فقط). */
type KeysetPage = {
  items: Array<{ media_id: number }>;
  total?: number;
  hasMore?: boolean;
  nextCursor?: string;
};

describe("MediaRepository — ترقيم keyset لقائمة المكتبة", () => {
  it("التمرير بالتزامن مع إدراج صفوف جديدة أعلى القائمة: لا تكرار ولا فراغ (recent DESC)", async () => {
    const libraryId = await insertLibrary("keyset-إدراج-أثناء-التمرير");

    // 12 صفاً أصلياً بتواريخ متدرجة قديمة.
    const originalIds: number[] = [];
    for (let i = 1; i <= 12; i++) {
      originalIds.push(
        await insertRow(
          libraryId,
          `فيلم ${i}`,
          `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
        ),
      );
    }

    // الصفحة الأولى عبر offset=0 (مسار الواجهة الفعلي لبداية القائمة).
    let page = (await repo.getLibraryMediaFiltered(libraryId, {
      ...PAGE,
      sortBy: "recent",
      sortOrder: "DESC",
    })) as unknown as KeysetPage;

    const collected: number[] = page.items.map((r) => r.media_id);

    // نمط الماسح الحي (total 2623→2648): قبل كل جلب جديد تُدرج 3 صفوف "أحدث"
    // أعلى الترتيب. المشي يستمر ما دام هناك أصليون لم يُسلَّموا بعد؛ المؤشر
    // يجب أن يظل موجوداً طالما بقيت صفوف أصلية أسفل النافذة.
    let lateRound = 0;
    const uniqueSoFar = () => new Set(collected).size;
    while (uniqueSoFar() < originalIds.length && lateRound < 10) {
      expect(page.nextCursor, "انقطع المؤشر قبل اكتمال تسليم الأصليين").toBeTruthy();
      lateRound += 1;
      for (let j = 1; j <= 3; j++) {
        await insertRow(
          libraryId,
          `وارد-متأخر ${lateRound}-${j}`,
          `2026-06-${String(lateRound).padStart(2, "0")}T00:00:${String(j).padStart(2, "0")}.000Z`,
        );
      }
      page = (await repo.getLibraryMediaFiltered(libraryId, {
        ...PAGE,
        sortBy: "recent",
        sortOrder: "DESC",
        cursor: page.nextCursor!,
      })) as unknown as KeysetPage;
      collected.push(...page.items.map((r) => r.media_id));
    }

    // أكمل حتى النهاية بعد توقف الإدراج.
    while (page.nextCursor) {
      page = (await repo.getLibraryMediaFiltered(libraryId, {
        ...PAGE,
        sortBy: "recent",
        sortOrder: "DESC",
        cursor: page.nextCursor,
      })) as unknown as KeysetPage;
      collected.push(...page.items.map((r) => r.media_id));
    }

    // العقد الأساسي: كل الأصلي مغطى مرة واحدة بلا تكرار ولا فراغ.
    const unique = new Set(collected);
    expect(unique.size, `تكرار في: ${collected.join(",")}`).toBe(collected.length);
    for (const id of originalIds) {
      expect(collected, `العنصر الأصلي ${id} فُقد (فراغ ترقيم)`).toContain(id);
    }
    // الواردات المتأخرة تقع أعلى نقطة انطلاق المؤشر — لا يجوز أن تتسرب للمشي.
    for (const id of collected) {
      expect(originalIds, `تسرب وارد متأخر ${id} إلى نتائج المشي`).toContain(id);
    }
  });

  it("الترتيب التصاعدي alpha ASC محصّن بالمثل أثناء الإدراج", async () => {
    const libraryId = await insertLibrary("keyset-alpha-asc");
    const letters = ["أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر"];
    const ids: number[] = [];
    for (const ch of letters)
      ids.push(await insertRow(libraryId, `عنوان-${ch}`, "2026-02-01T00:00:00.000Z"));

    let page = (await repo.getLibraryMediaFiltered(libraryId, {
      ...PAGE,
      limit: 4,
      sortBy: "title",
      sortOrder: "ASC",
    })) as unknown as KeysetPage;
    const seen = page.items.map((r) => r.media_id);

    while (page.nextCursor) {
      if (seen.length === 4)
        await insertRow(libraryId, "عنوان-00-يدخل-أولاً", "2026-03-01T00:00:00.000Z");
      page = (await repo.getLibraryMediaFiltered(libraryId, {
        ...PAGE,
        limit: 4,
        sortBy: "title",
        sortOrder: "ASC",
        cursor: page.nextCursor,
      })) as unknown as KeysetPage;
      seen.push(...page.items.map((r) => r.media_id));
    }

    expect(new Set(seen).size).toBe(seen.length);
    for (const id of ids) expect(seen).toContain(id);
  });

  it("تساوي مفتاح الفرز لا يسبب تخطياً ولا تكراراً (كسر التعادل بـmedia_id)", async () => {
    const libraryId = await insertLibrary("keyset-تعادل");
    const ids: number[] = [];
    for (let i = 0; i < 9; i++) {
      // created_at متطابقة تماماً لكل الصفوف.
      ids.push(await insertRow(libraryId, `متماثل-${i}`, "2026-04-04T04:04:04.000Z"));
    }

    const walked: number[] = [];
    let cursor: string | undefined;
    do {
      const page = (await repo.getLibraryMediaFiltered(libraryId, {
        ...PAGE,
        limit: 2,
        sortBy: "recent",
        sortOrder: "DESC",
        ...(cursor && { cursor }),
      })) as unknown as KeysetPage;
      walked.push(...page.items.map((r) => r.media_id));
      cursor = page.nextCursor;
    } while (cursor);

    expect(new Set(walked).size).toBe(walked.length);
    expect(walked.sort((a, b) => b - a)).toEqual([...ids].sort((a, b) => b - a));
  });

  it("صفوف created_at NULL تُرتب آخر القائمة DESC ولا تكسر المشي بالمؤشر", async () => {
    const libraryId = await insertLibrary("keyset-null-dates");
    const normal = await insertRow(libraryId, "بتاريخ", "2026-05-05T05:05:05.000Z");
    const nullDated = await insertRow(libraryId, "بلا-تاريخ", undefined);

    const all: number[] = [];
    let cursor: string | undefined;
    do {
      const page = (await repo.getLibraryMediaFiltered(libraryId, {
        ...PAGE,
        limit: 1,
        sortBy: "recent",
        sortOrder: "DESC",
        ...(cursor && { cursor }),
      })) as unknown as KeysetPage;
      all.push(...page.items.map((r) => r.media_id));
      cursor = page.nextCursor;
    } while (cursor);

    expect(all).toEqual([normal, nullDated]);
  });

  it("يرفض المؤشر التالف والمؤشر غير المطابق لترتيب الاستعلام", async () => {
    const libraryId = await insertLibrary("keyset-رفض");
    // صفاان كي تحمل الصفحة الأولى (limit=1) مؤشر hasMore=true فعلياً.
    await insertRow(libraryId, "الأحدث", "2026-07-08T07:07:07.000Z");
    await insertRow(libraryId, "الأقدم", "2026-07-07T07:07:07.000Z");
    const first = (await repo.getLibraryMediaFiltered(libraryId, {
      ...PAGE,
      limit: 1,
      sortBy: "recent",
      sortOrder: "DESC",
    })) as unknown as KeysetPage;

    await expect(
      repo.getLibraryMediaFiltered(libraryId, {
        ...PAGE,
        sortBy: "recent",
        cursor: "!!!ليس-base64!!!",
      }),
    ).rejects.toBeInstanceOf(MediaListCursorError);

    // مؤشر صالح البنية لكن بصمة ترتيبه مختلفة (ASC بدل DESC).
    const flipped = Buffer.from(
      JSON.stringify({ v: 1, s: "recent|ASC", k: "", i: 999999 }),
      "utf8",
    ).toString("base64url");
    await expect(
      repo.getLibraryMediaFiltered(libraryId, { ...PAGE, sortBy: "recent", cursor: flipped }),
    ).rejects.toBeInstanceOf(MediaListCursorError);

    expect(first.nextCursor).toBeTruthy();
  });
});
