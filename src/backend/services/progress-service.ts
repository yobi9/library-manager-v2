import { ProgressRepository } from "../repositories/progress-repository";
import { getEventBus } from "./event-bus";

export class ProgressService {
  constructor(private progressRepo: ProgressRepository) {}

  async getUserProgress(userId: number, mediaId: number) {
    return this.progressRepo.getUserProgress(userId, mediaId);
  }

  async getAllUserProgress(userId: number) {
    return this.progressRepo.getAllUserProgress(userId);
  }

  async upsertProgress(
    userId: number,
    mediaId: number,
    progressPercent: number,
    isFinished = false,
  ) {
    const result = await this.progressRepo.upsertProgress(
      userId,
      mediaId,
      progressPercent,
      isFinished,
    );
    getEventBus().emit("user_progress_update", { userId, mediaId, progressPercent, isFinished });
    return result;
  }

  async deleteUserProgress(userId: number, mediaId: number) {
    return this.progressRepo.deleteUserProgress(userId, mediaId);
  }
}
