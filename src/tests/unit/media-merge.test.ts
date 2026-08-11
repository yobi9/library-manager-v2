/**
 * اختبارات دمج المكررات الهرمية (سلسلة/موسيقى) عبر المجلدات.
 *
 * الغاية: تأمين سلوك منع التكرار أثناء المسح (`findDuplicate`) والدمج في
 * العرض فقط (`getMergedChildren`) — دون أي تعديل في قاعدة البيانات، وبحصر
 * صارم على: نفس المكتبة + نفس النوع + نفس الاسم المطبّع + جذر (بلا أب).
 *
 * ملاحظة: نُقلّد `@/backend/db/db` بجدول `media_items` مصغّر بدل تشغيل سلسلة
 * الهجرات الكاملة — هجرة `005` تفشل على قاعدة جديدة نقية (خلل موجود مسبقاً
 * خارج نطاق هذا الاختبار).
 */
import { describe, expect, it, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

vi.mock("@/backend/db/db", async () => {
  const db = await open({ filename: ":memory:", driver: sqlite3.Database });
  await db.exec(`CREATE TABLE media_items (
    media_id INTEGER PRIMARY KEY AUTOINCREMENT,
    library_id INTEGER,
    parent_media_id INTEGER,
    title TEXT,
    normalized_title TEXT,
    type TEXT,
    is_available INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    hierarchical_level INTEGER DEFAULT 0,
    is_leaf INTEGER DEFAULT 0,
    has_children INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  )`);
  return {
    getDatabase: async () => db,
    closeDatabase: async () => {},
  };
});

import { getDatabase } from "@/backend/db/db";
import { MediaRepository, normalizeTitle } from "@/backend/repositories/media-repository";

let repo: MediaRepository;
let db: Awaited<ReturnType<typeof getDatabase>>;

/** إدراج صف وسائط مع التحكم الكامل في الأعمدة المطلوبة. */
async function insertMedia(row: {
  library_id: number;
  type: string;
  title: string;
  normalized_title: string;
  parent_media_id?: number | null;
  is_available?: number;
  sort_order?: number;
}): Promise<number> {
  const result = await db.run(
    `INSERT INTO media_items (
       library_id, parent_media_id, title, normalized_title, type,
       is_available, sort_order, hierarchical_level, is_leaf, has_children,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.library_id,
      row.parent_media_id ?? null,
      row.title,
      row.normalized_title,
      row.type,
      row.is_available ?? 1,
      row.sort_order ?? 0,
      0,
      0,
      0,
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  );
  return Number(result.lastID);
}

beforeAll(async () => {
  db = await getDatabase();
  repo = new MediaRepository();
});

beforeEach(async () => {
  await db.exec("DELETE FROM media_items");
});

afterAll(async () => {
  // قاعدة في الذاكرة ضمن هذا الملف فقط — لا شيء يُغلق في المصنع.
});

describe("findDuplicate", () => {
  it("يعيد عنصراً جذرياً سابقاً بنفس الاسم المطبّع والنوع داخل المكتبة", async () => {
    const first = await insertMedia({
      library_id: 1,
      type: "series",
      title: "بروكن باد",
      normalized_title: normalizeTitle("بروكن باد"),
    });
    await insertMedia({
      library_id: 1,
      type: "series",
      title: "بروكن باد (فولدر ثانٍ)",
      normalized_title: normalizeTitle("بروكن باد"),
    });

    const found = await repo.findDuplicate({
      library_id: 1,
      type: "series",
      normalized_title: normalizeTitle("بروكن باد"),
      parent_media_id: null,
    });

    expect(found).not.toBeNull();
    expect(found?.["media_id"]).toBe(first);
  });

  it("يعيد null عند غياب مطابقة الاسم المطبّع", async () => {
    await insertMedia({
      library_id: 1,
      type: "series",
      title: "مسلسل أ",
      normalized_title: normalizeTitle("مسلسل أ"),
    });

    const found = await repo.findDuplicate({
      library_id: 1,
      type: "series",
      normalized_title: normalizeTitle("مسلسل غير موجود"),
      parent_media_id: null,
    });

    expect(found).toBeNull();
  });

  it("لا يطابق عبر المكتبات ولا عبر الأنواع ولا غير الجذور", async () => {
    await insertMedia({
      library_id: 2,
      type: "series",
      title: "اسم مشترك",
      normalized_title: normalizeTitle("اسم مشترك"),
    });
    await insertMedia({
      library_id: 1,
      type: "movie",
      title: "اسم مشترك",
      normalized_title: normalizeTitle("اسم مشترك"),
    });
    await insertMedia({
      library_id: 1,
      type: "season",
      title: "اسم مشترك",
      normalized_title: normalizeTitle("اسم مشترك"),
      parent_media_id: 1,
    });

    expect(
      await repo.findDuplicate({
        library_id: 1,
        type: "series",
        normalized_title: normalizeTitle("اسم مشترك"),
        parent_media_id: null,
      }),
    ).toBeNull();

    expect(
      await repo.findDuplicate({
        library_id: 1,
        type: "season",
        normalized_title: normalizeTitle("اسم مشترك"),
        parent_media_id: 1,
      }),
    ).not.toBeNull();

    expect(
      await repo.findDuplicate({
        library_id: 1,
        type: "season",
        normalized_title: normalizeTitle("اسم مشترك"),
        parent_media_id: 999,
      }),
    ).toBeNull();
  });
});

describe("getMergedChildren", () => {
  it("يجمّع كل أبناء العنصر وأبناء الإخوة بنفس الاسم داخل المكتبة فقط", async () => {
    const rootA = await insertMedia({
      library_id: 1,
      type: "series",
      title: "بروكن باد",
      normalized_title: normalizeTitle("بروكن باد"),
    });
    const rootB = await insertMedia({
      library_id: 1,
      type: "series",
      title: "بروكن باد (فولدر ثانٍ)",
      normalized_title: normalizeTitle("بروكن باد"),
    });
    const rootC = await insertMedia({
      library_id: 1,
      type: "series",
      title: "مسلسل آخر",
      normalized_title: normalizeTitle("مسلسل آخر"),
    });
    const rootD = await insertMedia({
      library_id: 2,
      type: "series",
      title: "بروكن باد",
      normalized_title: normalizeTitle("بروكن باد"),
    });

    const s1 = await insertMedia({
      library_id: 1,
      type: "season",
      title: "Season 1",
      normalized_title: normalizeTitle("Season 1"),
      parent_media_id: rootA,
      sort_order: 1,
    });
    const s2 = await insertMedia({
      library_id: 1,
      type: "season",
      title: "Season 2",
      normalized_title: normalizeTitle("Season 2"),
      parent_media_id: rootA,
      sort_order: 2,
    });
    const s3 = await insertMedia({
      library_id: 1,
      type: "season",
      title: "Season 1 (مجلد ثانٍ)",
      normalized_title: normalizeTitle("Season 1"),
      parent_media_id: rootB,
      sort_order: 1,
    });
    const sOther = await insertMedia({
      library_id: 1,
      type: "season",
      title: "موسم إضافي",
      normalized_title: normalizeTitle("موسم إضافي"),
      parent_media_id: rootB,
      sort_order: 3,
    });
    const sWrongSeries = await insertMedia({
      library_id: 1,
      type: "season",
      title: "موسم مختلف",
      normalized_title: normalizeTitle("موسم مختلف"),
      parent_media_id: rootC,
    });
    const sWrongLibrary = await insertMedia({
      library_id: 2,
      type: "season",
      title: "موسم مكتبة أخرى",
      normalized_title: normalizeTitle("موسم مكتبة أخرى"),
      parent_media_id: rootD,
    });

    const children = await repo.getMergedChildren(rootA, 1, "series", normalizeTitle("بروكن باد"));

    const ids = (children as Array<{ media_id: number }>).map((c) => c.media_id);
    expect(ids).toContain(s1);
    expect(ids).toContain(s2);
    expect(ids).toContain(s3);
    expect(ids).toContain(sOther);
    expect(ids).toHaveLength(4);
    expect(ids).not.toContain(sWrongSeries);
    expect(ids).not.toContain(sWrongLibrary);
  });

  it("يستبعد الأبناء غير المتاحين", async () => {
    const rootA = await insertMedia({
      library_id: 1,
      type: "series",
      title: "مسلسل توفر",
      normalized_title: normalizeTitle("مسلسل توفر"),
    });
    const hidden = await insertMedia({
      library_id: 1,
      type: "season",
      title: "موسم مخفي",
      normalized_title: normalizeTitle("موسم مخفي"),
      parent_media_id: rootA,
      is_available: 0,
    });

    const children = await repo.getMergedChildren(rootA, 1, "series", normalizeTitle("مسلسل توفر"));

    const ids = (children as Array<{ media_id: number }>).map((c) => c.media_id);
    expect(ids).not.toContain(hidden);
  });

  it("يتراجع إلى الأبناء المباشرين عندما يكون الاسم المطبّع فارغاً", async () => {
    const rootA = await insertMedia({
      library_id: 1,
      type: "series",
      title: "بدون تطبيع",
      normalized_title: normalizeTitle("بدون تطبيع"),
    });
    await insertMedia({
      library_id: 1,
      type: "series",
      title: "بدون تطبيع",
      normalized_title: normalizeTitle("بدون تطبيع"),
    });
    await insertMedia({
      library_id: 1,
      type: "season",
      title: "موسم مباشر",
      normalized_title: normalizeTitle("موسم مباشر"),
      parent_media_id: rootA,
    });

    const children = await repo.getMergedChildren(rootA, 1, "series", null);

    const rows = children as Array<{ media_id: number }>;
    expect(rows).toHaveLength(1);
  });
});
