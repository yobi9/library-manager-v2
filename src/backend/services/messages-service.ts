import { MessagesRepository } from "../repositories/messages-repository";
import { ActivityRepository } from "../repositories/activity-repository";

export class MessagesService {
  constructor(
    private messagesRepo: MessagesRepository,
    private activityRepo?: ActivityRepository,
  ) {}

  async getAll(
    filters: { type?: string; status?: string; userId?: number } = {},
    limit = 50,
    offset = 0,
  ) {
    return this.messagesRepo.list(filters, limit, offset);
  }

  async getById(id: number) {
    const item = await this.messagesRepo.getById(id);
    if (!item) throw new Error("Message not found");
    return item;
  }

  async create(data: Record<string, unknown>) {
    const result = await this.messagesRepo.create(data);
    this._logSystemEvent("message_sent", {
      title: (data.title as string) ?? null,
      type: (data.type as string) ?? null,
    });
    return result;
  }

  async updateStatus(id: number, status: string) {
    await this.getById(id);
    const result = await this.messagesRepo.updateStatus(id, status);
    this._logSystemEvent("message_status_updated", { id, status });
    return result;
  }

  async delete(id: number) {
    const item = (await this.getById(id)) as Record<string, unknown> | undefined;
    const result = await this.messagesRepo.remove(id);
    this._logSystemEvent("message_deleted", { id, title: (item?.["title"] as string) ?? null });
    return result;
  }

  /**
   * يسجّل حدث نظام في سجل الأنشطة بأمان: أي فشل في التسجيل يُطبَع فقط ولا
   * يعطّل العملية الأصلية.
   *
   * @param action - إجراء النظام (`message_sent` | `message_status_updated` | `message_deleted`).
   * @param details - تفاصيل العملية (معرّف الرسالة وعنوانها).
   */
  private _logSystemEvent(action: string, details: Record<string, unknown>): void {
    if (!this.activityRepo) return;
    void this.activityRepo
      .logActivity({
        entityType: "system",
        action,
        module: "messages",
        severity: "info",
        details,
      })
      .catch((err: Error) => {
        console.error(`[MessagesService] Failed to log ${action}:`, err.message);
      });
  }
}
