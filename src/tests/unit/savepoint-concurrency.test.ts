/**
 * اختبار وحدة لـ `withExclusiveTransaction` (قفل قائمة على اتصال SQLite الوحيد).
 *
 * الخلفية — الخطأ الحقيقي: بعد اكتمال مسح حقيقي (#33) ظهر
 * `SQLITE_ERROR: no such savepoint` لأن بث `scan:completed` يُطلق `backfillMissing`
 * (fire-and-forget في `services/index.ts`) بينما `cleanupOrphanedItems` لا يزال
 * ممسكاً بـ `SAVEPOINT` على نفس الاتصال. عندما تتقاطع معاملتان عبر `await`:
 * `RELEASE` للمعاملة الخارجية يُدمّر الحفظات الداخلية المتداخلة، فيفشل `RELEASE`
 * الداخلي بـ "no such savepoint".
 *
 * الغاية: ضمان أن المستخدمين الثلاثة للـ SAVEPOINT (مشي العناصر في media-sync،
 * cleanupOrphanedItems، withTransaction في base-repository) لا يتقاطعون أبداً —
 * قفل FIFO يسمح بمعاملة SAVEPOINT واحدة مفتوحة فقط في اللحظة الواحدة.
 */
import { describe, expect, it } from "vitest";
import { getDatabase, withExclusiveTransaction } from "@/backend/db/db";

/** أداة إشارة صغيرة تسمح للاختبار بانتظار/تحرير نقطة في سلسلة async. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("withExclusiveTransaction — قفل استبعاد على الاتصال المشترك", () => {
  it("لا يسمح بتداخل معاملتي SAVEPOINT (سيناريو الانهيار الفعلي)", async () => {
    const db = await getDatabase();
    const order: string[] = [];

    const outerOpened = deferred();
    const releaseOuter = deferred();
    const innerOpened = deferred();
    const releaseInner = deferred();

    const t1 = withExclusiveTransaction(async () => {
      order.push("outer:enter");
      await db.run("SAVEPOINT sp_mutex_outer");
      outerOpened.resolve();
      await releaseOuter.promise;
      await db.run("RELEASE SAVEPOINT sp_mutex_outer");
      order.push("outer:exit");
    });

    await outerOpened.promise;

    const t2 = withExclusiveTransaction(async () => {
      order.push("inner:enter");
      await db.run("SAVEPOINT sp_mutex_inner");
      innerOpened.resolve();
      await releaseInner.promise;
      await db.run("RELEASE SAVEPOINT sp_mutex_inner");
      order.push("inner:exit");
    });

    // لولا القفل لدخلت t2 متداخلة داخل معاملة t1، و`RELEASE sp_mutex_outer`
    // أدناه كان سيُدمّر `sp_mutex_inner` فيفشل `RELEASE` اللاحق بـ
    // "no such savepoint". مع القفل يجب أن تنتظر t2 حتى تخرج t1 تماماً.
    releaseOuter.resolve();
    await innerOpened.promise;
    releaseInner.resolve();

    await Promise.all([t1, t2]);

    expect(order).toEqual(["outer:enter", "outer:exit", "inner:enter", "inner:exit"]);
  });

  it("يُحرّر القفل دائماً حتى عند فشل الكتلة", async () => {
    const order: string[] = [];

    const failing = withExclusiveTransaction(async () => {
      order.push("first:enter");
      throw new Error("boom");
    });

    await expect(failing).rejects.toThrow("boom");

    const second = withExclusiveTransaction(async () => {
      order.push("second:enter");
    });

    await second;
    expect(order).toEqual(["first:enter", "second:enter"]);
  });
});
