import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * اختبار توزيع المسار POST/PATCH على /api/enrich/metadata/:id.
 *
 * الغاية: العميل (ItemManagementDialog) يرسل POST عبر `use-admin-media.ts`
 * بينما كان المسار يصدّر PATCH فقط فيفشل الحفظ بـ 405 — يضمن هذا الاختبار
 * بقاء POST وPATCH مقبولَين ومرور الحمل الصحيح.
 *
 * يتم mocking أدوات الـ route والـ controllers لعزل اختبار توزيع المسار نفسه.
 */
vi.mock("@/backend/controllers", () => ({
  getControllers: vi.fn(),
}));

vi.mock("@/backend/api/route-helpers", () => ({
  requireAdmin: vi.fn(() => "session-token"),
  parseBody: vi.fn(async () => ({ title: "فيلم تجريبي" })),
  toNextResponse: (data: unknown) => ({ ok: true, data }),
  handleRouteError: (error: unknown) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Unknown error",
  }),
}));

import { POST, PATCH } from "@/app/api/enrich/metadata/[id]/route";
import { getControllers } from "@/backend/controllers";

const mockRequest = {} as unknown as NextRequest;

/**
 * يجهّز الـ mock للـ controllers ويُعيد مُحاكاة `updateMetadataManually`.
 */
function mockControllerUpdate() {
  const updateMetadataManually = vi.fn().mockResolvedValue({ success: true, data: { ok: true } });
  (getControllers as ReturnType<typeof vi.fn>).mockReturnValue({
    enrichment: { updateMetadataManually },
  });
  return updateMetadataManually;
}

describe("POST/PATCH /api/enrich/metadata/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("يقبل POST ويفوض الحمل إلى updateMetadataManually", async () => {
    const updateMetadataManually = mockControllerUpdate();
    const res = await POST(mockRequest, { params: Promise.resolve({ id: "7" }) });
    expect(updateMetadataManually).toHaveBeenCalledWith(7, { title: "فيلم تجريبي" });
    expect(res).toEqual({ ok: true, data: { success: true, data: { ok: true } } });
  });

  it("يبقي PATCH متاحاً", async () => {
    const updateMetadataManually = mockControllerUpdate();
    const res = await PATCH(mockRequest, { params: Promise.resolve({ id: "9" }) });
    expect(updateMetadataManually).toHaveBeenCalledWith(9, { title: "فيلم تجريبي" });
    expect(res.ok).toBe(true);
  });

  it("يرجع خطأ route عند فشل الخدمة", async () => {
    const updateMetadataManually = vi.fn().mockRejectedValue(new Error("Media not found"));
    (getControllers as ReturnType<typeof vi.fn>).mockReturnValue({
      enrichment: { updateMetadataManually },
    });
    const res = await POST(mockRequest, { params: Promise.resolve({ id: "7" }) });
    expect(res).toEqual({ ok: false, error: "Media not found" });
  });
});
