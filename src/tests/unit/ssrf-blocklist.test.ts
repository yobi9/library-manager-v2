/**
 * اختبار حارس SSRF الموحّد (isBlockedHostname).
 *
 * الغاية: الـ regex السابق كان يختتم بـ `$` خارج المجموعة فلم يحظر أي عنوان
 * IP خاص (127.0.0.1 / 10.0.0.1 / 192.168.x / 172.16-31.x / 169.254.x).
 * هذا الاختبار يثبت أن الفحص أصبح بادئاً (prefix) وغير حساس لحالة الأحرف.
 */
import { describe, expect, it } from "vitest";
import { isBlockedHostname } from "@/backend/services/tmdb-enrichment-service";

describe("isBlockedHostname (SSRF)", () => {
  it("يحظر النطاقات الخاصة والمحلية المعروفة", () => {
    const blocked = [
      "127.0.0.1",
      "10.0.0.1",
      "192.168.1.5",
      "172.16.0.1",
      "172.17.0.1",
      "172.20.10.1",
      "172.31.0.1",
      "169.254.169.254",
      "0.0.0.0",
      "localhost",
      "localhost.localdomain",
      "LOCALHOST",
      "[::1]",
      "metadata.google.internal",
      "169.254.1.1",
    ];
    for (const hostname of blocked) {
      expect(isBlockedHostname(hostname), `must block ${hostname}`).toBe(true);
    }
  });

  it("يسمح بالمضيفات العامة", () => {
    const allowed = ["image.tmdb.org", "8.8.8.8", "1.1.1.1", "example.com", "api.themoviedb.org"];
    for (const hostname of allowed) {
      expect(isBlockedHostname(hostname), `must allow ${hostname}`).toBe(false);
    }
  });
});
