/**
 * اختبارات وحدة ContentAccessPolicyService — Global Blocklist.
 *
 * تختبر الدوال النقية الثلاثة:
 * - `resolveBlockedCertifications`: تحديد قائمة الحظر بناءً على المستخدم والإعدادات
 * - `shouldBlockMedia`: التحقق من حظر عنصر محدد
 * - `buildCertificationSqlFilter`: بناء شرط SQL للاستبعاد
 */

import { describe, it, expect } from "vitest";
import {
  resolveBlockedCertifications,
  shouldBlockMedia,
  buildCertificationSqlFilter,
} from "@/backend/services/content-access-policy";
import type { ContentFilter } from "@/backend/services/content-access-policy";
import type { AuthContext } from "@/backend/api/route-helpers";

/* ─────────────── resolveBlockedCertifications ─────────────── */

describe("resolveBlockedCertifications", () => {
  const baseSettings: Record<string, unknown> = {
    parental_control_enabled: true,
    blocked_certifications: ["R", "NC-17", "18+"],
  };

  it("يُعطّل الفلترة للمدير (admin bypass)", () => {
    const auth: AuthContext = { userId: 1, username: "admin", isAdmin: true };
    const result = resolveBlockedCertifications(auth, baseSettings);
    expect(result).toEqual({ enabled: false, blockedCertifications: [] });
  });

  it("يُعطّل الفلطة عندما parental_control_enabled = false", () => {
    const auth: AuthContext = { userId: 2, username: "user", isAdmin: false };
    const settings = { parental_control_enabled: false, blocked_certifications: ["R"] };
    const result = resolveBlockedCertifications(auth, settings);
    expect(result).toEqual({ enabled: false, blockedCertifications: [] });
  });

  it("يُفعّل الفلترة للمستخدم العادي مع blocked_certifications", () => {
    const auth: AuthContext = { userId: 2, username: "user", isAdmin: false };
    const result = resolveBlockedCertifications(auth, baseSettings);
    expect(result).toEqual({ enabled: true, blockedCertifications: ["R", "NC-17", "18+"] });
  });

  it("يعيد blockedCertifications فارغة إذا parental_control_enabled بدون blocked_certifications", () => {
    const auth: AuthContext = { userId: 2, username: "user", isAdmin: false };
    const settings = { parental_control_enabled: true };
    const result = resolveBlockedCertifications(auth, settings);
    expect(result).toEqual({ enabled: true, blockedCertifications: [] });
  });

  it("يعالج blocked_certifications كـ string (ليس array) — يعيد فارغة", () => {
    const auth: AuthContext = { userId: 2, username: "user", isAdmin: false };
    const settings = { parental_control_enabled: true, blocked_certifications: "R,NC-17" };
    const result = resolveBlockedCertifications(auth, settings);
    expect(result).toEqual({ enabled: true, blockedCertifications: [] });
  });

  it("يعالج الزائر غير المسجّل (auth = null) كمستخدم عادي", () => {
    const result = resolveBlockedCertifications(null, baseSettings);
    expect(result).toEqual({ enabled: true, blockedCertifications: ["R", "NC-17", "18+"] });
  });

  it("يُعطّل الفلترة للزائر إذا الإعدادات غير مفعّلة", () => {
    const settings = { parental_control_enabled: false };
    const result = resolveBlockedCertifications(null, settings);
    expect(result).toEqual({ enabled: false, blockedCertifications: [] });
  });

  it("يتعامل مع الإعدادات الفارغة كلياً", () => {
    const auth: AuthContext = { userId: 2, username: "user", isAdmin: false };
    const result = resolveBlockedCertifications(auth, {});
    expect(result).toEqual({ enabled: false, blockedCertifications: [] });
  });
});

/* ─────────────── shouldBlockMedia ─────────────── */

describe("shouldBlockMedia", () => {
  it("لا يحظر عندما الفلترة غير مفعّلة", () => {
    const filter: ContentFilter = { enabled: false, blockedCertifications: ["R"] };
    expect(shouldBlockMedia("R", filter)).toBe(false);
  });

  it("يحظر عنصر بتصنيف محظور", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: ["R", "NC-17"] };
    expect(shouldBlockMedia("R", filter)).toBe(true);
  });

  it("لا يحظر عنصر بتصنيف غير محظور", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: ["R", "NC-17"] };
    expect(shouldBlockMedia("PG-13", filter)).toBe(false);
  });

  it("لا يحظر المحتوى بدون تصنيف (null)", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: ["R"] };
    expect(shouldBlockMedia(null, filter)).toBe(false);
  });

  it("لا يحظر المحتوى بدون تصنيف (undefined)", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: ["R"] };
    expect(shouldBlockMedia(undefined, filter)).toBe(false);
  });

  it("لا يحظر المحتوى بدون تصنيف (empty string)", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: ["R"] };
    expect(shouldBlockMedia("", filter)).toBe(false);
  });

  it("لا يحظر المحتوى بتصنيف whitespace فقط", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: ["R"] };
    expect(shouldBlockMedia("   ", filter)).toBe(false);
  });

  it("يحظر عندما القائمة المحظورة فارغة لكن الفلترة مفعّلة والعنصر له تصنيف", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: [] };
    expect(shouldBlockMedia("R", filter)).toBe(false);
  });

  it("يُميّز بين أحرف كبيرة وصغيرة (case-sensitive)", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: ["R"] };
    expect(shouldBlockMedia("r", filter)).toBe(false);
    expect(shouldBlockMedia("R", filter)).toBe(true);
  });
});

/* ─────────────── buildCertificationSqlFilter ─────────────── */

describe("buildCertificationSqlFilter", () => {
  it("يعيد null عندما الفلترة غير مفعّلة", () => {
    const filter: ContentFilter = { enabled: false, blockedCertifications: ["R"] };
    expect(buildCertificationSqlFilter(filter)).toBeNull();
  });

  it("يعيد null عندما القائمة المحظورة فارغة", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: [] };
    expect(buildCertificationSqlFilter(filter)).toBeNull();
  });

  it("يبني شرط SQL صحيح لتصنيف واحد", () => {
    const filter: ContentFilter = { enabled: true, blockedCertifications: ["R"] };
    const result = buildCertificationSqlFilter(filter);
    expect(result).not.toBeNull();
    expect(result!.clause).toBe(
      "(m.certification NOT IN (?) OR m.certification IS NULL OR m.certification = '')",
    );
    expect(result!.values).toEqual(["R"]);
  });

  it("يبني شرط SQL صحيح لعدة تصنيفات", () => {
    const filter: ContentFilter = {
      enabled: true,
      blockedCertifications: ["R", "NC-17", "18+"],
    };
    const result = buildCertificationSqlFilter(filter);
    expect(result).not.toBeNull();
    expect(result!.clause).toBe(
      "(m.certification NOT IN (?,?,?) OR m.certification IS NULL OR m.certification = '')",
    );
    expect(result!.values).toEqual(["R", "NC-17", "18+"]);
  });

  it("يحافظ على ترتيب القيم", () => {
    const filter: ContentFilter = {
      enabled: true,
      blockedCertifications: ["TV-MA", "R", "NC-17"],
    };
    const result = buildCertificationSqlFilter(filter);
    expect(result!.values).toEqual(["TV-MA", "R", "NC-17"]);
  });
});
