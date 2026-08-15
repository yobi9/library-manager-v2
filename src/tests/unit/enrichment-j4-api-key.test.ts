/**
 * اختبارات J4 من تدقيق metadata-enrichment-deep-audit.md:
 * حفظ مفتاح TMDB API في إعدادات النظام بدل الذاكرة المؤقتة فقط.
 *
 * 1) `saveApiKey` يثبّت المفتاح في إعداد `tmdb_api_key` عبر `SettingsService`
 *    (مع تسجيل المستخدم والـ IP في تدقيق الإعدادات).
 * 2) «قراءة بعد إعادة البناء»: خدمة جديدة (بدل إعادة تشغيل الخادم) تسترجع
 *    المفتاح المحفوظ عبر `loadApiKeyFromSettings`.
 * 3) حدث `settings_updated` يحدّث المفتاح في الذاكرة لخدمة قائمة دون إعادة بناء.
 * 4) سجل تدقيق الإعدادات يُقنّع قيمة المفتاح السري (لا يخزّن النص صريحاً).
 * 5) `saveApiKey` دون `SettingsService` يحافظ على التوافق الخلفي (ذاكرة فقط).
 *
 * يُستخدم هنا سجل إعدادات وقاعدة بيانات حقيقية في الذاكرة (مشتركة بين
 * اتصالي القراءة والكتابة عبر `SHARED_MEMORY_URI` في db.ts).
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDatabase, closeDatabase } from "@/backend/db/db";
import { getEventBus } from "@/backend/services/event-bus";
import { TmdbEnrichmentService } from "@/backend/services/tmdb-enrichment-service";
import { SettingsService } from "@/backend/services/settings-service";
import { SettingsRepository } from "@/backend/repositories/settings-repository";
import { CacheService } from "@/backend/services/cache-service";
import { ActivityRepository } from "@/backend/repositories/activity-repository";
import { MediaRepository } from "@/backend/repositories/media-repository";
import { EnrichmentMediaRepository } from "@/backend/repositories/enrichment-media-repository";
import { LibraryRepository } from "@/backend/repositories/library-repository";
import { EnrichmentApprovalRepository } from "@/backend/repositories/enrichment-repository";
import { SearchRepository } from "@/backend/repositories/search-repository";

let db: Awaited<ReturnType<typeof getDatabase>>;
let settingsRepo: SettingsRepository;
let settingsService: SettingsService;
let adminUserId: number;

beforeAll(async () => {
  db = await getDatabase();
  settingsRepo = new SettingsRepository();
  settingsService = new SettingsService(settingsRepo, new CacheService(new ActivityRepository()));
  // مستخدم صالح لأن `settings_audit_log.user_id` مرتبط بـ FK إلى `users`.
  const user = await db.run(
    `INSERT INTO users (username, password, is_admin) VALUES ('j4_admin', 'dummy-hash', 1)`,
  );
  if (!user.lastID) throw new Error("Failed to seed j4 admin user");
  adminUserId = user.lastID;
});

afterAll(async () => {
  await closeDatabase();
});

/**
 * يبني خدمة إثراء حقيقية (مستودعات حقيقية) مع مفتاح وسلوك اختياري تجاه
 * `SettingsService` (لاختبار التوافق الخلفي عند غيابها).
 *
 * @param apiKey - مفتاح يُمرَّر للـ constructor (افتراضياً فارغ كحالة الخادم الحقيقية).
 * @param withSettings - هل نمرّر `SettingsService` للخدمة (افتراضياً نعم).
 * @returns نسخة جاهزة من `TmdbEnrichmentService`.
 */
function buildService(apiKey = "", withSettings = true): TmdbEnrichmentService {
  return new TmdbEnrichmentService(
    new EnrichmentMediaRepository(),
    new MediaRepository(),
    new LibraryRepository(),
    new EnrichmentApprovalRepository(),
    new SearchRepository(),
    apiKey,
    {},
    undefined,
    withSettings ? settingsService : undefined,
  );
}

/**
 * يمسح أي أثر سابق لمفتاح `tmdb_api_key` من جدولي الإعدادات والتدقيق.
 */
async function cleanApiKeyRows(): Promise<void> {
  await settingsRepo.deleteSetting("tmdb_api_key");
  await db.run("DELETE FROM settings_audit_log WHERE setting_key = 'tmdb_api_key'");
}

describe("J4: حفظ مفتاح TMDB في الإعدادات", () => {
  it("يحفظ المفتاح عبر saveApiKey ثم تقرأه خدمة جديدة بعد إعادة البناء", async () => {
    await cleanApiKeyRows();

    const service = buildService("");
    await service.saveApiKey("persisted-key-123", adminUserId, "127.0.0.1");

    expect(await settingsRepo.getSetting("tmdb_api_key")).toBe("persisted-key-123");

    // «إعادة بناء» الخدمة (مثل إعادة تشغيل الخادم) دون مفتاح constructor:
    // يجب أن يستعيد المفتاح المحفوظ من قاعدة البيانات.
    const rebuilt = buildService("");
    expect(await rebuilt.loadApiKeyFromSettings()).toBe("persisted-key-123");
  });

  it("يحدّث حدث settings_updated المفتاح في الذاكرة لخدمة قائمة", async () => {
    const service = buildService("old-key");
    const svc = service as unknown as { apiKey: string };
    expect(svc.apiKey).toBe("old-key");

    getEventBus().emit("settings_updated", {
      key: "tmdb_api_key",
      value: "event-key-456",
      userId: 1,
    });

    expect(svc.apiKey).toBe("event-key-456");
  });

  it("يُقنّع قيمة المفتاح السري في سجل تدقيق الإعدادات", async () => {
    await cleanApiKeyRows();

    await settingsService.updateSettings(
      { tmdb_api_key: "first-secret-key" },
      adminUserId,
      "10.0.0.5",
    );
    await settingsService.updateSettings(
      { tmdb_api_key: "second-secret-key" },
      adminUserId,
      "10.0.0.5",
    );

    const rows = (await db.all(
      `SELECT setting_key, old_value, new_value, user_id, ip_address
       FROM settings_audit_log
       WHERE setting_key = 'tmdb_api_key'`,
    )) as Array<{
      setting_key: string;
      old_value: string | null;
      new_value: string;
      user_id: number | null;
      ip_address: string | null;
    }>;

    // تحديثان → صفّا تدقيق (changed_at بدقة الثانية فلا نعتمد على الترتيب).
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.new_value).toBe("***");
      // المستخدم والـ IP يُسجّلان بشكل طبيعي حتى مع تقنيع القيمة.
      expect(row.user_id).toBe(adminUserId);
      expect(row.ip_address).toBe("10.0.0.5");
    }
    // القيمة القديمة: الصف الأول لم يكن لديه قيمة سابقة (null) والثاني له قيمة مقنّعة.
    const oldValues = rows.map((r) => r.old_value);
    expect(oldValues).toHaveLength(2);
    expect(oldValues).toContain(null);
    expect(oldValues).toContain("***");

    // لا يظهر أي جزء من المفتاحين في أي صف تدقيق للمفتاح.
    const allRows = (await db.all(
      "SELECT old_value, new_value FROM settings_audit_log WHERE setting_key = 'tmdb_api_key'",
    )) as Array<{ old_value: string | null; new_value: string }>;
    const joined = allRows.map((r) => `${r.old_value ?? ""}${r.new_value}`).join("|");
    expect(joined).not.toContain("secret-key");
  });

  it("يحفظ المفتاح في الذاكرة فقط دون SettingsService (توافق خلفي)", async () => {
    await cleanApiKeyRows();

    const service = buildService("initial-key", false);
    const svc = service as unknown as { apiKey: string };

    await service.saveApiKey("memory-only-key");
    expect(svc.apiKey).toBe("memory-only-key");
    // القاعدة لم تُلمس.
    expect(await settingsRepo.getSetting("tmdb_api_key")).toBeNull();
  });
});
