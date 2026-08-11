/**
 * اختبار تراجعي لسباق المعاملات في فهرس البحث FTS5.
 *
 * الخلفية: بعد اكتمال المسح يُبثّ `scan:completed`، وفيه:
 *   1) `cleanupOrphanedItems` يفتح `SAVEPOINT` خاماً ويبقيه مفتوحاً خلال حلقة
 *      بطيئة من `fs.access` على نفس اتصال sqlite3 المشترك (singleton).
 *   2) بالتوازي (fire-and-forget)، `SearchService.backfillSearchIndex()` تشغّل
 *      `backfillMissing()`/`rebuildIndex()` التي كانت تستخدم `db.exec("BEGIN")`
 *      خاماً — و`BEGIN` داخل معاملة قائمة (الـ SAVEPOINT) يفشل بـ
 *      "cannot start a transaction within a transaction" → خطأ حرج.
 *
 * الغاية: ضمان أن إعادة بناء/تعبئة الفهرس تُدار عبر `withTransaction`
 * (SAVEPOINT قابل للتطعيس الآمن) وليس عبر `BEGIN` الخام — فينجح العمل حتى
 * لو كان الاتصال داخل معاملة مفتوحة (محاكاة الحالة الفعلية بعد المسح).
 *
 * ملاحظة: نقوم بمحاكاة النصف الأول من السباق (فتح SAVEPOINT يدوياً) ثم تشغيل
 * عمليات البحث — أي اختبار فاشل سابقاً ينجح الآن.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDatabase, closeDatabase } from "@/backend/db/db";
import { SearchRepository } from "@/backend/repositories/search-repository";

let db: Awaited<ReturnType<typeof getDatabase>>;
let searchRepo: SearchRepository;

beforeAll(async () => {
  db = await getDatabase();
  searchRepo = new SearchRepository();
});

afterAll(async () => {
  await closeDatabase();
});

/** يدرج عنصر وسائط حقيقياً (يُطلق الـ INSERT trigger فيملأ `media_search`). */
async function seedMediaItem(title: string): Promise<number> {
  const result = await db.run(
    `INSERT INTO media_items (title, type, is_available, created_at) VALUES (?, 'movie', 1, datetime('now'))`,
    [title],
  );
  if (!result.lastID) throw new Error("Failed to seed media item");
  return result.lastID;
}

describe("SearchRepository داخل معاملة مفتوحة (SAVEPOINT خام)", () => {
  it("backfillMissing ينجح بينما الاتصال داخل SAVEPOINT مفتوح", async () => {
    await db.run("SAVEPOINT sp_test_backfill_outer");

    await seedMediaItem("فيلم عربي للتعبئة");

    const inserted = await searchRepo.backfillMissing();
    expect(inserted).toBeGreaterThanOrEqual(1);

    const withKey = (await db.get(
      "SELECT COUNT(*) as cnt FROM media_search WHERE title = ? AND phonetic_key != ''",
      ["فيلم عربي للتعبئة"],
    )) as { cnt: number };
    expect(withKey.cnt).toBeGreaterThanOrEqual(1);

    await db.run("RELEASE SAVEPOINT sp_test_backfill_outer");
  });

  it("rebuildIndex ينجح بينما الاتصال داخل SAVEPOINT مفتوح", async () => {
    await db.run("SAVEPOINT sp_test_rebuild_outer");

    await seedMediaItem("فيلم عربي لإعادة البناء");

    await expect(searchRepo.rebuildIndex()).resolves.toBeUndefined();

    const row = (await db.get("SELECT media_id, phonetic_key FROM media_search WHERE title = ?", [
      "فيلم عربي لإعادة البناء",
    ])) as { media_id: number; phonetic_key: string } | undefined;
    expect(row).toBeDefined();

    await db.run("RELEASE SAVEPOINT sp_test_rebuild_outer");
  });

  it("بدون أي معاملة مفتوحة تبقى العمليات سليمة (sanity)", async () => {
    await seedMediaItem("فيلم عربي أساسي");

    const inserted = await searchRepo.backfillMissing();
    expect(inserted).toBeGreaterThanOrEqual(1);
    await expect(searchRepo.rebuildIndex()).resolves.toBeUndefined();
  });
});
