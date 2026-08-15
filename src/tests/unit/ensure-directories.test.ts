/**
 * اختبار ضمان إنشاء مجلدات خدمات التخزين (`ensureDirectories`).
 *
 * الغاية: إثبات أن `ImageService`:
 * 1. ينشئ المجلدات (الأساسي + posters/backdrops/persons) في مسار
 *    `image_storage_root` المطلق عند بدء التشغيل.
 * 2. يعيد الإنشاء فوراً عند إصدار حدث `settings_updated` بمفتاح
 *    `image_storage_root` (تغيير الإعداد أو إعادة ضبطه).
 * 3. يتوقف عن الاستجابة للحدث بعد `dispose()`.
 *
 * يُستخدم `settingsService` وهمي يعيد مسار `mkdtemp` حتى لا يمس الاختبار
 * مجلد `public` الحقيقي للمشروع.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getEventBus } from "@/backend/services/event-bus";
import { ImageService } from "@/backend/services/image-service";
import type { ImageRepository } from "@/backend/repositories/image-repository";

/** استبدال وهمي لـ SettingsService يعيد قيمة `image_storage_root` قابلة للتغيير. */
class FakeSettingsService {
  private value = "";

  constructor(initial: string) {
    this.value = initial;
  }

  setValue(value: string): void {
    this.value = value;
  }

  async getSetting(key: string): Promise<string | undefined> {
    return key === "image_storage_root" ? this.value : undefined;
  }
}

/** ينتظر حتى يتحقق مسند (بحد أقصى مهلة) أو يفشل الاختبار. */
async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("waitFor: انتهت المهلة دون تحقق الشرط");
}

/** يتحقق من وجود مجلدات صور الإثراء الأربعة في جذر التخزين المحدد. */
async function expectEnrichedDirs(root: string): Promise<void> {
  for (const name of ["posters", "backdrops", "persons"]) {
    await expect(fs.stat(path.join(root, name))).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });
  }
}

describe("ImageService.ensureDirectories", () => {
  let tempRoot: string;
  let service: ImageService | null = null;

  afterEach(async () => {
    service?.dispose();
    service = null;
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }
  });

  it("ينشئ المجلدات الأربعة عند بدء التشغيل في مسار مطلق", async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "img-root-"));
    const settings = new FakeSettingsService(tempRoot);
    service = new ImageService({} as ImageRepository, settings as never);

    await waitFor(async () => {
      try {
        await fs.stat(path.join(tempRoot, "posters"));
        return true;
      } catch {
        return false;
      }
    });

    await expectEnrichedDirs(tempRoot);
  });

  it("يعيد الإنشاء فوراً عند تغيير image_storage_root عبر الحدث", async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "img-root-"));
    const newRoot = path.join(tempRoot, "new");
    const settings = new FakeSettingsService(tempRoot);
    service = new ImageService({} as ImageRepository, settings as never);

    // ننتظر إتمام الإنشاء الأول ثم نغيِّر المسار ونصدر الحدث.
    await waitFor(async () => {
      try {
        await fs.stat(path.join(tempRoot, "posters"));
        return true;
      } catch {
        return false;
      }
    });

    settings.setValue(newRoot);
    getEventBus().emit("settings_updated", { key: "image_storage_root", value: newRoot });

    await waitFor(async () => {
      try {
        await fs.stat(path.join(newRoot, "posters"));
        return true;
      } catch {
        return false;
      }
    });

    await expectEnrichedDirs(newRoot);
  });

  it("يتجاهل الأحداث غير المرتبطة بـ image_storage_root", async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "img-root-"));
    const settings = new FakeSettingsService(tempRoot);
    service = new ImageService({} as ImageRepository, settings as never);
    await waitFor(async () => {
      try {
        await fs.stat(path.join(tempRoot, "posters"));
        return true;
      } catch {
        return false;
      }
    });

    // إحداثيات أخرى لا يجب أن تُحدث أي تغيير (لا رمي ولا إعادة إنشاء).
    getEventBus().emit("settings_updated", { key: "other_setting", value: "x" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expectEnrichedDirs(tempRoot);
  });

  it("يتوقف عن الاستجابة للحدث بعد dispose()", async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "img-root-"));
    const newRoot = path.join(tempRoot, "disposed");
    const settings = new FakeSettingsService(tempRoot);
    service = new ImageService({} as ImageRepository, settings as never);
    await waitFor(async () => {
      try {
        await fs.stat(path.join(tempRoot, "posters"));
        return true;
      } catch {
        return false;
      }
    });

    service.dispose();
    settings.setValue(newRoot);
    getEventBus().emit("settings_updated", { key: "image_storage_root", value: newRoot });

    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(fs.stat(path.join(newRoot, "posters"))).rejects.toThrow();
  });
});
