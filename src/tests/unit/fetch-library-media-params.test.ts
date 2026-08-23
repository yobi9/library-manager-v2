/**
 * اختبارات عقد بناء معاملات الطلب في `fetchLibraryMedia`.
 *
 * الخلفية: كان إسقاط معامل `cursor` من معاملات الطلب هو السبب الجذري لتكرار
 * عناصر التمرير اللانهائي في صفحة المكتبة — كل طلب صفحة لاحقة كان يصل إلى
 * الخادم بلا مؤشر ومع `offset=0`، فيعيد رأس القائمة من جديد.
 *
 * العقد المقفول هنا (مطابق لتوثيق `LibraryMediaParams`):
 * 1. وجود `cursor` ⇒ يُرسَل المؤشر ويُحذف `offset` كلياً.
 * 2. غياب `cursor` ⇒ يُرسَل `offset` (افتراضياً "0") ولا يُرسَل مؤشر.
 * 3. الأساسيات (limit/sortBy/sortOrder/rootOnly) تُرسَل دائماً.
 * 4. الفلاتر الاختيارية (year/search/genre/certification) تُرسَل فقط عند
 *    تحديدها.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/lib/frontend/api-client", () => ({
  apiClient: { get: getMock },
}));

import { fetchLibraryMedia } from "@/lib/frontend/api-media";

/**
 * يستخرج معاملات الطلب من أول استدعاء مسجَّل لـ `apiClient.get` ويتحقق من
 * مسار الطلب المتوقع لمكتبة المعرّف 7.
 *
 * @returns سجل معاملات الاستعلام كما مُرِّر إلى `apiClient.get`.
 * @throws خطأ Vitest إذا لم يُستدعَ `apiClient.get` أو كان المسار مخالفاً.
 */
function firstCallParams(): Record<string, string> {
  const call = getMock.mock.calls[0];
  expect(call, "كان يجب أن يُستدعى apiClient.get مرة واحدة").toBeDefined();
  const [url, params] = call as [string, Record<string, string>];
  expect(url).toBe("/libraries/7/media");
  return params;
}

describe("fetchLibraryMedia — عقد وضعَي الترقيم (cursor/offset)", () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ items: [], pagination: { total: 0, hasMore: false } });
  });

  it("عند وجود cursor: يُرسَل المؤشر وحده ولا يُرسَل offset", async () => {
    await fetchLibraryMedia(7, { cursor: "YWJj", limit: 12 });

    const params = firstCallParams();
    expect(params.cursor).toBe("YWJj");
    expect(params.offset).toBeUndefined();
    expect(params.limit).toBe("12");
  });

  it("عند غياب cursor: يُرسَل offset الافتراضي (0) ولا يُرسَل cursor", async () => {
    await fetchLibraryMedia(7, {});

    const params = firstCallParams();
    expect(params.offset).toBe("0");
    expect(params.cursor).toBeUndefined();
  });

  it("الأساسيات والفلاتر المحددة كلها تنقل كما هي", async () => {
    await fetchLibraryMedia(7, {
      cursor: "c2Vjb25k",
      limit: 24,
      sortBy: "title",
      sortOrder: "ASC",
      year: "2024",
      genre: "دراما",
      certification: "PG",
      search: "نص",
    });

    const params = firstCallParams();
    expect(params.sortBy).toBe("title");
    expect(params.sortOrder).toBe("ASC");
    expect(params.rootOnly).toBe("true");
    expect(params.year).toBe("2024");
    expect(params.genre).toBe("دراما");
    expect(params.certification).toBe("PG");
    expect(params.search).toBe("نص");
  });

  it("الفلاتر غير المحددة لا تظهر في معاملات الطلب والافتراضيات مطبقة", async () => {
    await fetchLibraryMedia(7, { limit: 10 });

    const params = firstCallParams();
    expect(params.year).toBeUndefined();
    expect(params.genre).toBeUndefined();
    expect(params.certification).toBeUndefined();
    expect(params.search).toBeUndefined();
    expect(params.limit).toBe("10");
    expect(params.sortBy).toBe("recent");
    expect(params.sortOrder).toBe("DESC");
  });
});
