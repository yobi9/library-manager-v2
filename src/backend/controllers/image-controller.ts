import { BaseController } from "./base-controller";
import type { ImageService, ImageType, ImageProcessOptions } from "../services/image-service";

const VALID_IMAGE_TYPES = ["poster", "backdrop", "library", "person", "still"] as const;

/**
 * يقرأ قيمة رقمية صحيحة من نص اختياري (يستخدم للبارامترات `w/h/q`).
 *
 * @param value - القيمة الخام من الاستعلام.
 * @param fallback - القيمة الاحتياطية عند الغياب أو القيمة غير الصالحة.
 * @returns القيمة الرقمية أو الـ fallback.
 */
function parsePositiveInt(value: string | null | undefined, fallback?: number): number | undefined {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (isNaN(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export class ImageController extends BaseController {
  constructor(private imageService: ImageService) {
    super();
  }

  async getImage(id: string, typeParam: string, opts: Record<string, string | null> = {}) {
    try {
      const imageId = this.parseId(id);
      const type: ImageType = VALID_IMAGE_TYPES.includes(typeParam as ImageType)
        ? (typeParam as ImageType)
        : "poster";
      const processOptions: ImageProcessOptions = {
        w: parsePositiveInt(opts["w"]),
        h: parsePositiveInt(opts["h"]),
        q: parsePositiveInt(opts["q"]),
      };
      const result = await this.imageService.getImage(imageId, type, processOptions);
      if (!result) return this.notFound("Image not found");
      return { success: true, status: 200, data: result };
    } catch (err) {
      return this.handleError(err);
    }
  }
}
