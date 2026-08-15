/**
 * اختبار أدوات المسارات (`path-utils.ts`): كشف مسار القرص المطلق الحقيقي وضمان
 * إنشاء المجلدات.
 *
 * الغاية: إثبات أن `isAbsoluteDiskPath` يفرّق بين مسار القرص المطلق (`C:\...`
 * و `\\server\...`) والمسار web-relative (`/assets/...`) — وهو تمييز لا يصح
 * الاعتماد فيه على `path.isAbsolute` في Node على ويندوز (يُعامل `/assets`
 * كمستوٍ على جذر المحرك). وضمان أن `ensureDirs` ينشئ المجلدات (متفرّعة) مرة
 * واحدة ويعيد النجاح عند وجودها مسبقاً.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureDirs, isAbsoluteDiskPath } from "@/backend/utils/path-utils";

describe("isAbsoluteDiskPath", () => {
  it("يعتبر مسارات القرص المطلقة الحقيقية مسارات مطلقة", () => {
    const absolute = ["C:\\assets\\images", "D:/assets/images", "C:/foo", "\\\\server\\share"];
    for (const candidate of absolute) {
      expect(isAbsoluteDiskPath(candidate), `must accept ${candidate}`).toBe(true);
    }
  });

  it("يرفض المسارات web-relative والنسبية", () => {
    const relative = [
      "/assets/images/enriched",
      "/assets/images",
      "assets/images/enriched",
      "images",
      "",
      "C:foo",
    ];
    for (const candidate of relative) {
      expect(isAbsoluteDiskPath(candidate), `must reject ${candidate}`).toBe(false);
    }
  });
});

describe("ensureDirs", () => {
  it("ينشئ المجلدات المتفرّعة في مسار مؤقت", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ensure-dirs-"));
    const target = path.join(root, "a", "b", "c");
    try {
      await ensureDirs([target], "test");
      const stat = await fs.stat(target);
      expect(stat.isDirectory()).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("يكون تكرارياً ولا يفشل عندما تكون المجلدات موجودة", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ensure-dirs-"));
    try {
      await ensureDirs([root], "test");
      await expect(ensureDirs([root], "test")).resolves.toBeUndefined();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
