/**
 * اختبار إنشاء قاعدة جديدة من الصفر (وصاية على سلاسل الهجرات).
 *
 * الغاية: ضمان أن `initializeDatabase` يستطيع تهيئة قاعدة `:memory:` جديدة
 * بالكامل دون فشل، وأن كل ملفات هجرات V2 الموجودة فعلياً في
 * `src/backend/db/migrations` تُسجَّل كمنفّذة، وأن المخطط الناتج يحمل
 * الصيغ الصحيحة (مثل `media_people.character` من 001 — لم تكن هناك حاجة
 * لهجرة rename، لذا لا يُتوقع تسجيلها).
 *
 * ملاحظة: يُشغَّل هنا السلك الحقيقي بالكامل (لا mock) لأن `DATABASE_URL`
 * مضبوط إلى `:memory:` في `src/tests/setup.ts`.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDatabase, closeDatabase } from "@/backend/db/db";

const V2_MIGRATION_FILES = [
  "001_initial_schema.sql",
  "002_normalize_settings_boolean_types.sql",
  "002_search_sync_triggers.sql",
  "003_image_settings.sql",
  "004_external_image_storage.sql",
  "006_admin_actions_as_system_events.sql",
  "007_drop_user_creation_trigger.sql",
  "008_drop_login_success_trigger.sql",
  "009_activity_actor.sql",
  "010_delete_memory_alerts.sql",
  "011_login_attempts.sql",
];

let db: Awaited<ReturnType<typeof getDatabase>>;

beforeAll(async () => {
  db = await getDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("initializeDatabase على قاعدة جديدة (memory)", () => {
  it("يُهيّئ السلسلة كاملة دون فشل ويسجّل جميع هجرات V2", async () => {
    const applied = (await db.all("SELECT filename FROM _migrations")) as Array<{
      filename: string;
    }>;
    const appliedNames = new Set(applied.map((r) => r.filename));

    for (const file of V2_MIGRATION_FILES) {
      expect(appliedNames.has(file), `الهجرة ${file} مسجّلة كمنفّذة`).toBe(true);
    }
  });

  it("يترك عمود media_people بالصيغة الصحيحة character دون character_name", async () => {
    const cols = (await db.all("PRAGMA table_info(media_people)")) as Array<{ name: string }>;
    const names = cols.map((c) => c.name);

    expect(names).toContain("character");
    expect(names).not.toContain("character_name");
  });

  it("يحافظ على بقية جداول المخطط الأساسية", async () => {
    const tables = (await db.all("SELECT name FROM sqlite_master WHERE type = 'table'")) as Array<{
      name: string;
    }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("media_items");
    expect(tableNames).toContain("activities");
    expect(tableNames).toContain("settings");
  });
});
