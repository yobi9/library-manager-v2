import { BaseController } from "./base-controller";
import type { ProgressService } from "../services/progress-service";

export class ProgressController extends BaseController {
  constructor(private progressService: ProgressService) {
    super();
  }

  async getAll(userId: number) {
    try {
      const progress = await this.progressService.getAllUserProgress(userId);
      return this.ok(progress);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getOne(userId: number, mediaId: string) {
    try {
      const id = this.parseId(mediaId);
      const progress = await this.progressService.getUserProgress(userId, id);
      return this.ok(progress);
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsert(userId: number, mediaId: string, data: Record<string, unknown>) {
    try {
      const id = this.parseId(mediaId);
      await this.progressService.upsertProgress(
        userId,
        id,
        data["progressPercent"] as number,
        data["isFinished"] as boolean,
      );
      return this.ok(null, "Progress updated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  async delete(userId: number, mediaId: string) {
    try {
      const id = this.parseId(mediaId);
      await this.progressService.deleteUserProgress(userId, id);
      return this.ok(null, "Progress deleted");
    } catch (err) {
      return this.handleError(err);
    }
  }
}
