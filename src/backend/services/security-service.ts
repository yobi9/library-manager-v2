import { SecurityEventRepository } from "../repositories/security-repository";

export class SecurityService {
  constructor(private securityRepo: SecurityEventRepository) {}

  async logSecurityEvent(params: {
    userId?: number | null;
    eventType: string;
    severity?: string;
    details?: unknown;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    return this.securityRepo.logSecurityEvent(params);
  }

  async getAllSecurityEvents(limit = 50, offset = 0) {
    return this.securityRepo.getAllSecurityEvents(limit, offset);
  }

  async countEvents(): Promise<number> {
    return this.securityRepo.countEvents();
  }

  async getUserSecurityEvents(userId: number, limit = 30) {
    return this.securityRepo.getUserSecurityEvents(userId, limit);
  }

  async resolveSecurityEvent(eventId: number, resolvedByUserId: number) {
    return this.securityRepo.resolveSecurityEvent(eventId, resolvedByUserId);
  }

  async deleteOldEvents(days = 90) {
    return this.securityRepo.deleteOldEvents(days);
  }
}
