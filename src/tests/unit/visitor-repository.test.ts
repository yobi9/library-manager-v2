/**
 * اختبار تراجعي لسباق الإنشاء المتزامن في `visitors`.
 *
 * الخلفية — الخطأ الحقيقي: كان `updateVisitorActivity` ينفّذ SELECT ثم INSERT
 * منفصلين (check-then-act). عند وصول عدة طلبات متزامنة لنفس الجلسة
 * (`visitor_session_id`) قبل وجود صف لها في `visitors`، يرى كل طلب أن الصف
 * غير موجود ثم يحاولون الإدراج معاً فيفشل الكل عدا واحد بـ
 * `SQLITE_CONSTRAINT: UNIQUE constraint failed: visitors.device_id` — ما كان
 * يُسقط الصفحة العامة (500) كما حدث فعلياً في `/itemView/movie/104175`.
 *
 * الغاية: ضمان أن الإنشاء/التحديث ذري (`ON CONFLICT ... RETURNING id`) فلا
 * يرمي القيد مهما تزامنت الطلبات، وأن يبقى صف واحد لكل `device_id` مع عدد
 * أحداث مطابق. نفس الفحص لـ `addVisitorRequest` (الذي كان يملك السباق نفسه).
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDatabase, closeDatabase } from "@/backend/db/db";
import { VisitorRepository } from "@/backend/repositories/visitor-repository";

let db: Awaited<ReturnType<typeof getDatabase>>;
let repo: VisitorRepository;

beforeAll(async () => {
  db = await getDatabase();
  repo = new VisitorRepository();
});

afterAll(async () => {
  await closeDatabase();
});

/** يعدّ صفوف `visitors` لمعرّف جهاز محدد. */
async function countVisitors(deviceId: string): Promise<number> {
  const rows = (await db.all(
    "SELECT COUNT(*) as cnt FROM visitors WHERE device_id = ?",
    [deviceId],
  )) as { cnt: number }[];
  return rows[0]!.cnt;
}

/** يعدّ أحداث الزيارات لمعرّف جلسة محدد. */
async function countVisitEvents(sessionId: string): Promise<number> {
  const rows = (await db.all(
    "SELECT COUNT(*) as cnt FROM visitor_events WHERE session_id = ? AND event_type = 'visit'",
    [sessionId],
  )) as { cnt: number }[];
  return rows[0]!.cnt;
}

describe("VisitorRepository — الإدراج الذري للزوار", () => {
  it("تسجيل متزامن لنفس الجلسة لا يرمي UNIQUE constraint ويبقى صفاً واحداً", async () => {
    const sessionId = "session-race-1";
    const concurrent = 20;

    await Promise.all(
      Array.from({ length: concurrent }, (_, i) =>
        repo.updateVisitorActivity(
          sessionId,
          `10.0.0.${i}`,
          "Mozilla/5.0 (Windows NT 10.0)",
          "windows",
          "",
        ),
      ),
    );

    expect(await countVisitors(sessionId)).toBe(1);
    expect(await countVisitEvents(sessionId)).toBe(concurrent);
  });

  it("التحديث المتسلسل لنفس الجلسة يحدّث الصف نفسه بدل إنشاء آخر", async () => {
    const sessionId = "session-seq-1";

    await repo.updateVisitorActivity(sessionId, "10.0.0.1", "UA-v1", "windows", "");
    await repo.updateVisitorActivity(sessionId, "10.0.0.2", "UA-v2", "android", "");

    expect(await countVisitors(sessionId)).toBe(1);
    expect(await countVisitEvents(sessionId)).toBe(2);

    const row = (await db.get(
      "SELECT ip_address, user_agent, device_type FROM visitors WHERE device_id = ?",
      [sessionId],
    )) as { ip_address: string; user_agent: string; device_type: string };
    expect(row.ip_address).toBe("10.0.0.2");
    expect(row.user_agent).toBe("UA-v2");
    expect(row.device_type).toBe("android");
  });

  it("رسائل طلبات متزامنة لنفس الجهاز لا ترمي UNIQUE constraint", async () => {
    const deviceId = "device-race-1";
    const concurrent = 10;

    await Promise.all(
      Array.from({ length: concurrent }, (_, i) =>
        repo.addVisitorRequest(deviceId, `message-${i}`, "10.0.0.9", "UA-req"),
      ),
    );

    expect(await countVisitors(deviceId)).toBe(1);

    const rows = (await db.all(
      "SELECT COUNT(*) as cnt FROM visitor_events WHERE event_type = 'request' AND user_id = ?",
      [deviceId],
    )) as { cnt: number }[];
    expect(rows[0]!.cnt).toBe(concurrent);
  });
});
