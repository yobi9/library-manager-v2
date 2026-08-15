import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnrichmentController } from "@/backend/controllers/enrichment-controller";
import { TmdbEnrichmentService } from "@/backend/services/tmdb-enrichment-service";
import { MetadataService } from "@/backend/services/metadata-service";
import { EnrichmentMediaRepository } from "@/backend/repositories/enrichment-media-repository";
import { EnrichmentApprovalRepository } from "@/backend/repositories/enrichment-repository";

/**
 * اختبار حارس SSRF في مسار رفع الصورة على مستوى الـ Controller.
 *
 * الغاية: القائمة السابقة كانت تفحص البادئة "172.16." فقط، فكانت عناوين
 * 172.17.0.0/16 – 172.31.0.0/16 تمر (ثغرة SSRF في RFC1918). بعد اعتماد
 * isBlockedHostname الموحّد يجب رفضها كلها في الـ Controller.
 */
describe("EnrichmentController.uploadImageFromUrl (SSRF)", () => {
  let controller: EnrichmentController;
  const uploadImageFromUrl = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    uploadImageFromUrl.mockReset();
    uploadImageFromUrl.mockResolvedValue({ path: "/assets/images/enriched/poster/x.jpg" });
    const serviceStub = { uploadImageFromUrl } as unknown as TmdbEnrichmentService;
    controller = new EnrichmentController(
      serviceStub,
      {} as unknown as MetadataService,
      {} as unknown as EnrichmentMediaRepository,
      {} as unknown as EnrichmentApprovalRepository,
    );
  });

  it("يرفض روابط النطاق الخاص 172.16.0.0/12 كاملة (بما فيها 172.17–172.31)", async () => {
    for (const url of [
      "http://172.16.0.1/x.jpg",
      "http://172.17.0.1/x.jpg",
      "http://172.20.10.1/x.jpg",
      "http://172.31.0.1/x.jpg",
      "http://127.0.0.1/x.jpg",
      "http://10.0.0.5/x.jpg",
      "http://192.168.1.10/x.jpg",
      "http://169.254.169.254/x.jpg",
      "http://localhost/x.jpg",
    ]) {
      const res = await controller.uploadImageFromUrl({
        mediaId: 1,
        imageUrl: url,
        type: "poster",
        storageMode: "local",
      });
      expect(res).toEqual({ success: false, status: 403, error: "URL target not allowed" });
    }
    expect(uploadImageFromUrl).not.toHaveBeenCalled();
  });

  it("يسمح برابط TMDB عام ويفوض للخدمة", async () => {
    const res = await controller.uploadImageFromUrl({
      mediaId: 1,
      imageUrl: "https://image.tmdb.org/t/p/w500/x.jpg",
      type: "poster",
      storageMode: "local",
    });
    expect(res).toEqual({
      success: true,
      status: 200,
      data: { path: "/assets/images/enriched/poster/x.jpg" },
    });
    expect(uploadImageFromUrl).toHaveBeenCalledWith(
      1,
      "https://image.tmdb.org/t/p/w500/x.jpg",
      "poster",
      "local",
    );
  });

  it("يرفض البروتوكولات غير http(s)", async () => {
    const res = await controller.uploadImageFromUrl({
      mediaId: 1,
      imageUrl: "ftp://example.com/x.jpg",
      type: "poster",
      storageMode: "local",
    });
    expect(res).toEqual({ success: false, status: 400, error: "Only HTTP/HTTPS URLs allowed" });
  });
});
