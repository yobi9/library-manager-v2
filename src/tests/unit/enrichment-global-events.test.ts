import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getEventBus } from "@/backend/services/event-bus";
import { TmdbEnrichmentService } from "@/backend/services/tmdb-enrichment-service";
import type { EnrichmentMediaRepository } from "@/backend/repositories/enrichment-media-repository";
import type { MediaRepository } from "@/backend/repositories/media-repository";
import type { LibraryRepository } from "@/backend/repositories/library-repository";
import type { EnrichmentApprovalRepository } from "@/backend/repositories/enrichment-repository";
import type { SearchRepository } from "@/backend/repositories/search-repository";

/**
 * يعيد كائن عنصر وسائط وهمي صالح لمسار النجاح في `enrichItem`.
 *
 * @param id - معرّف العنصر المراد.
 * @returns صف وسائط يطابق ما يتوقعه مسار الإثراء.
 */
function fakeMediaRow(id: number): Record<string, unknown> {
  return {
    id,
    media_id: id,
    library_id: 1,
    title: "Test Movie",
    type: "movie",
    year: 2020,
  };
}

/**
 * يبني خدمة الإثراء بمستودعات وهمية وباستبدال الطرق الخاصة بالشبكة
 * كي يمر مسار النجاح دون أي اتصال خارجي أو قاعدة بيانات.
 *
 * @param mediaGetById - سلوك `mediaRepo.getById` (صف وسائط أو null للفشل).
 * @returns نسخة جاهزة من `TmdbEnrichmentService`.
 */
function buildService(mediaGetById: () => unknown): TmdbEnrichmentService {
  const service = new TmdbEnrichmentService(
    {} as unknown as EnrichmentMediaRepository,
    { getById: vi.fn(mediaGetById) } as unknown as MediaRepository,
    {} as unknown as LibraryRepository,
    {} as unknown as EnrichmentApprovalRepository,
    {} as unknown as SearchRepository,
    "test-api-key",
  );
  (service as unknown as { _searchTMDB: () => Promise<unknown> })._searchTMDB = async () => ({
    result: { id: 5, title: "Test Movie" },
    score: 0.9,
  });
  (
    service as unknown as { _fetchFromTmdb: () => Promise<Record<string, unknown>> }
  )._fetchFromTmdb = async () => ({ ok: true });
  (
    service as unknown as { _applyEnrichmentFromDetails: () => Promise<void> }
  )._applyEnrichmentFromDetails = async () => undefined;
  return service;
}

describe("بث أحداث الإثراء على الحافلة العامة (metadata_completed)", () => {
  let received: unknown[] = [];

  beforeEach(() => {
    received = [];
    getEventBus().on("metadata_completed", (data?: unknown) => {
      received.push(data);
    });
  });

  afterEach(() => {
    getEventBus().removeAllListeners();
  });

  it("يبث نجاح الإثراء الفردي على الحافلة العامة", async () => {
    const service = buildService(() => fakeMediaRow(1));
    const result = await service.enrichItem(1);

    expect(result.success).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ success: true, source: "tmdb" });
  });

  it("يكتم البث العام عند emitGlobal=false (مسار الجلسة الجماعية)", async () => {
    const service = buildService(() => fakeMediaRow(1));
    await service.enrichItem(1, {}, false);

    expect(received).toHaveLength(0);
  });

  it("يبث الجلسة الجماعية حدثاً واحداً مجمّعاً فقط مع success=true", async () => {
    const service = buildService(() => fakeMediaRow(1));
    const result = await service.enrichBatch([1, 2]);

    expect(result.successful).toBe(2);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ success: true, successful: 2, failed: 0 });
  });

  it("يبث الجلسة الجماعية الفاشلة success=false فلا يحدث إبطال كاش", async () => {
    const service = buildService(() => null);
    const result = await service.enrichBatch([1]);

    expect(result.failed).toBe(1);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ success: false, successful: 0, failed: 1 });
  });

  it("يتخطى الإثراء الفردي أثناء مسح نشط مع بث skipped ولا يعالج العنصر", async () => {
    const service = buildService(() => fakeMediaRow(1));
    (service as unknown as { isScanActive: () => boolean }).isScanActive = () => true;

    const result = await service.enrichItem(1);

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ success: false, skipped: true });
  });

  it("يتخطى الجلسة الجماعية أثناء مسح نشط كاملةً دون معالجة أي عنصر", async () => {
    const service = buildService(() => fakeMediaRow(1));
    (service as unknown as { isScanActive: () => boolean }).isScanActive = () => true;

    const result = await service.enrichBatch([1, 2, 3]);

    expect(result.skipped).toBe(3);
    expect(result.successful).toBe(0);
    expect(result.failed).toBe(0);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ success: false, skipped: 3, total: 3 });
  });
});
