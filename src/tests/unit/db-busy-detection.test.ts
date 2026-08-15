/**
 * اختبار وحدة لأدلة رصد تصادم قفل الكتابة (`db.busy_detected`) في `wrapDbMethods`.
 *
 * الخلفية: تقرير جذر SQLITE_BUSY رصد 22× فشل كتابة سجل النشاط على الاتصال
 * الرئيسي أثناء إثراء دفعات، وبطء HTTP بمقدار 30–90s، لكن «مَن يمسك قفل الكتابة
 * ≥30 ثانية» لم يكن مثبتاً. هذه الأداة تسجّل، لحظة أي `SQLITE_BUSY` على أي
 * اتصال، صورة عن الاتصال الآخر: العبارة قيد التنفيذ والمعاملة المفتوحة عليه
 * (الحامل المرجّح للقفل).
 *
 * الغاية: إثبات أن العبارة المتصادمة على `main` تُنتج حدث `db.busy_detected`
 * يظهر فيه `otherOpenTxn` الخاص بمعاملة `SAVEPOINT` مفتوحة على `writer`.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import { getDatabase, runInWriterContext } from "@/backend/db/db";
import { logger } from "@/backend/observability/logger";

/** أداة إشارة صغيرة تسمح للاختبار بانتظار/تحرير نقطة في سلسلة async. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("db.busy_detected — أدلة حامل قفل الكتابة عند SQLITE_BUSY", () => {
  beforeEach(() => {
    process.env.DEV_LOG_FILE = path.join(os.tmpdir(), `db-busy-test-${Date.now()}.jsonl`);
  });

  afterEach(() => {
    delete process.env.DEV_LOG_FILE;
    vi.restoreAllMocks();
  });

  it("يرصد التصادم على main ويُظهر معاملة SAVEPOINT المفتوحة على writer كحامل مرجّح", async () => {
    const warnSpy = vi.spyOn(logger, "warn");
    const db = await getDatabase();
    await db.exec(`CREATE TABLE IF NOT EXISTS t_busy_test (id INTEGER PRIMARY KEY, v TEXT)`);

    const writerEntered = deferred();
    const releaseWriter = deferred();

    // الكاتب يفتح SAVEPOINT ويكتب داخله ثم يبقى ممسكاً بقفل الكتابة (لا RELEASE).
    const writerTask = runInWriterContext(async () => {
      const wdb = await getDatabase();
      await wdb.run("SAVEPOINT sp_hold");
      await wdb.run("INSERT INTO t_busy_test (v) VALUES (?)", ["x"]);
      writerEntered.resolve();
      await releaseWriter.promise;
      await wdb.run("RELEASE SAVEPOINT sp_hold");
    });

    await writerEntered.promise;

    // قراءة/كتابة على الاتصال الرئيسي تتصادم مع قفل الكاتب؛ نُقلّص busy_timeout
    // حتى يثبت التصادم سريعاً بدل انتظار 30s الافتراضية.
    await db.run("PRAGMA busy_timeout = 10");
    const mainWrite = db.run("INSERT INTO t_busy_test (v) VALUES (?)", ["y"]);

    await expect(mainWrite).rejects.toThrow(/locked|busy/i);

    releaseWriter.resolve();
    await writerTask;

    // الحدث `db.busy_detected` ظهر مع دليل المعاملة المفتوحة على الاتصال الآخر.
    const busyEvents = warnSpy.mock.calls.filter(([event]) => event === "db.busy_detected");
    expect(busyEvents.length).toBeGreaterThan(0);

    const [, fields] = busyEvents[0] as [string, Record<string, unknown>];
    expect(fields["connection"]).toBe("main");
    expect(fields["otherConnection"]).toBe("writer");
    expect(fields["otherOpenTxn"]).toEqual(expect.objectContaining({ keyword: "SAVEPOINT" }));
  });
});
