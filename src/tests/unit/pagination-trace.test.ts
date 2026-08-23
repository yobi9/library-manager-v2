import { describe, expect, it } from "vitest";
import {
  buildMediaListScope,
  PaginationSkewTracker,
} from "@backend/observability/pagination-trace";

/** شكل حقول حدث مسجَّل في الاختبار. */
interface TestLogFields {
  [key: string]: unknown;
}

/** بيئة اختبار موحّدة: وقت افتراضي + مصدر أحداث مسجَّل. */
function makeTracker() {
  let clock = 1_000_000;
  const events: Array<{ level: string; event: string; fields: TestLogFields }> = [];
  const tracker = new PaginationSkewTracker({
    now: () => clock,
    emit: (level, event, fields) => events.push({ level, event, fields }),
  });
  return {
    tracker,
    events,
    advance: (ms: number) => {
      clock += ms;
    },
    warnCount: () => events.filter((e) => e.event === "pagination.snapshot_skew").length,
    pageServedCount: () => events.filter((e) => e.event === "media.page_served").length,
  };
}

describe("buildMediaListScope", () => {
  it("يتجاهل offset/limit ويميز الفلاتر المختلفة", () => {
    const base = { rootOnly: true, sortBy: "recent", sortOrder: "DESC" };
    expect(buildMediaListScope(base, 0)).toBe(buildMediaListScope(base, 0));
    expect(buildMediaListScope({ ...base }, 2)).not.toBe(buildMediaListScope({ ...base }, 0));
    expect(buildMediaListScope({ ...base, genre: "أكشن" }, 0)).not.toBe(
      buildMediaListScope(base, 0),
    );
  });
});

describe("PaginationSkewTracker", () => {
  it("صفحة أولى ثم صفحات متطابقة الإجمالي = لا تحذير", () => {
    const t = makeTracker();
    t.tracker.observePage({ libraryId: 22, scope: "s", offset: 0, total: 100, count: 24, firstId: 5, lastId: 1 });
    t.tracker.observePage({ libraryId: 22, scope: "s", offset: 24, total: 100, count: 12, firstId: 30, lastId: 19 });
    expect(t.warnCount()).toBe(0);
    expect(t.pageServedCount()).toBe(2);
  });

  it("تغيّر الإجمالي في صفحة لاحقة داخل النافذة = تحذير واحد ببيانات الانزياح", () => {
    const t = makeTracker();
    t.tracker.observePage({ libraryId: 22, scope: "s", offset: 0, total: 100, count: 24, firstId: 5, lastId: 1 });
    t.advance(30_000);
    t.tracker.observePage({ libraryId: 22, scope: "s", offset: 24, total: 103, count: 12, firstId: 30, lastId: 19 });
    expect(t.warnCount()).toBe(1);
    t.tracker.observePage({ libraryId: 22, scope: "s", offset: 36, total: 103, count: 12, firstId: 42, lastId: 31 });
    // لا تكرار لنفس التغيّر: المرساة حُدِّثت بعد الإنذار
    expect(t.warnCount()).toBe(1);
    const warn = t.events.find((e) => e.event === "pagination.snapshot_skew");
    expect(warn?.fields).toMatchObject({
      libraryId: 22,
      offset: 24,
      expectedTotal: 100,
      actualTotal: 103,
      shift: 3,
    });
  });

  it("مرساة منتهية النافذة لا تنتج تحذيراً", () => {
    const t = makeTracker();
    t.tracker.observePage({ libraryId: 22, scope: "s", offset: 0, total: 100, count: 24, firstId: 5, lastId: 1 });
    t.advance(5 * 60 * 1000 + 1);
    t.tracker.observePage({ libraryId: 22, scope: "s", offset: 24, total: 200, count: 12, firstId: 9, lastId: 8 });
    expect(t.warnCount()).toBe(0);
  });

  it("المكتبات/البصمات المختلفة معزولة عن بعضها", () => {
    const t = makeTracker();
    t.tracker.observePage({ libraryId: 22, scope: "a", offset: 0, total: 100, count: 10, firstId: 5, lastId: 1 });
    t.tracker.observePage({ libraryId: 43, scope: "a", offset: 24, total: 999, count: 10, firstId: 7, lastId: 6 });
    t.tracker.observePage({ libraryId: 22, scope: "b", offset: 24, total: 888, count: 10, firstId: 7, lastId: 6 });
    expect(t.warnCount()).toBe(0);
  });

  it("لمسة الحياة تمنع انتهاء صلاحية مرساة جلسة نشطة", () => {
    const t = makeTracker();
    t.tracker.observePage({ libraryId: 22, scope: "s", offset: 0, total: 100, count: 24, firstId: 5, lastId: 1 });
    for (let i = 0; i < 30; i++) {
      t.advance(20_000); // إجمالي 10 دقائق بفواصل نشطة أقصر من النافذة
      t.tracker.observePage({ libraryId: 22, scope: "s", offset: 24 + i * 12, total: 100, count: 12, firstId: 40 - i, lastId: 29 - i });
    }
    t.tracker.observePage({ libraryId: 22, scope: "s", offset: 500, total: 104, count: 12, firstId: 60, lastId: 49 });
    expect(t.warnCount()).toBe(1);
  });
});
