import bcrypt from "bcryptjs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { UserRepository } from "../repositories/user-repository";
import { UserSessionRepository } from "../repositories/session-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { SecurityEventRepository } from "../repositories/security-repository";
import { getEventBus } from "./event-bus";
import { logger } from "../observability/logger";
import { ensureDirs } from "../utils/path-utils";

/** مجلد صور المستخدمين (الصور الرمزية) داخل `public` — مسار ثابت بلا إعداد مؤثر. */
const AVATARS_DIR = path.join(process.cwd(), "public", "assets", "images", "avatars");

export class UserService {
  constructor(
    private userRepo: UserRepository,
    private sessionRepo: UserSessionRepository,
    private activityRepo: ActivityRepository,
    private securityRepo: SecurityEventRepository,
  ) {
    // إنشاء مجلد الصور الرمزية `public/assets/images/avatars` عند بدء التشغيل
    // ليكون جاهزاً قبل أول رفع صورة — الفشل يُسجَّل فقط ولا يعطّل التشغيل.
    void this.ensureDirectories();
  }

  /**
   * يضمن وجود مجلد الصور الرمزية للمستخدمين `public/assets/images/avatars`
   * (مسار ثابت نسبي لجذر المشروع، بلا إعداد مؤثر عليه).
   *
   * - السلوك: لا يرمي الخطأ أبداً — الفشل يُسجَّل عبر `logger` فقط.
   *
   * @returns وعد ينجز عند ضمان وجود المجلد (أو تسجيل الفشل).
   */
  async ensureDirectories(): Promise<void> {
    try {
      await ensureDirs([AVATARS_DIR], "UserService");
    } catch (err) {
      logger.error("users.dirs_ensure_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private checkAccess(
    callerUserId: number,
    callerIsAdmin: boolean,
    targetUserId: number,
    action: string,
  ) {
    if (!callerIsAdmin && callerUserId !== targetUserId) {
      throw new Error(`Unauthorized: cannot ${action} another user`);
    }
  }

  private preventSelfAction(callerUserId: number, targetUserId: number, action: string) {
    if (callerUserId === targetUserId) {
      throw new Error(`Cannot ${action} yourself`);
    }
  }

  async createUser(
    userData: Record<string, unknown>,
    callerUserId: number,
    callerIsAdmin: boolean,
  ) {
    if (!callerIsAdmin) throw new Error("Unauthorized: admin only");

    if (!userData["username"] || !userData["password"])
      throw new Error("Username and password are required");

    const existing = await this.userRepo.findByUsername(userData["username"] as string);
    if (existing) throw new Error("Username already exists");

    if (userData["email"]) {
      const emailUser = (await this.userRepo.getByField("email", userData["email"])) as
        Record<string, unknown> | undefined;
      if (emailUser) throw new Error("Email already exists");
    }

    const hashedPassword = await bcrypt.hash(userData["password"] as string, 10);
    const newUser = await this.userRepo.create({
      ...userData,
      password: hashedPassword,
      display_name: (userData["display_name"] as string) || (userData["username"] as string),
      is_admin: userData["is_admin"] ? 1 : 0,
      is_blocked: 0,
    });

    await this.activityRepo.logActivity({
      userId: callerUserId,
      action: "create_user",
      details: { username: userData["username"] },
      module: "users",
      entityType: "system",
    });

    getEventBus().emit("user_created", {
      userId: (newUser as Record<string, unknown>)["user_id"],
      username: userData["username"],
    });

    return this.sanitizeUser(newUser as Record<string, unknown>);
  }

  async updateUser(
    userId: number,
    updates: Record<string, unknown>,
    callerUserId: number,
    callerIsAdmin: boolean,
  ) {
    this.checkAccess(callerUserId, callerIsAdmin, userId, "update");

    const existing = await this.userRepo.getById(userId);
    if (!existing) throw new Error("User not found");

    if (!callerIsAdmin) {
      if (updates["is_admin"] !== undefined || updates["is_blocked"] !== undefined) {
        throw new Error("Cannot change admin or block status");
      }
    }

    if (
      updates["username"] &&
      updates["username"] !== (existing as Record<string, unknown>)["username"]
    ) {
      const dup = await this.userRepo.findByUsername(updates["username"] as string);
      if (dup) throw new Error("Username already exists");
    }

    if (updates["email"]) {
      const emailUser = (await this.userRepo.getByField("email", updates["email"])) as
        Record<string, unknown> | undefined;
      if (emailUser && emailUser["user_id"] !== userId) {
        throw new Error("Email already exists");
      }
    }

    if (updates["password"]) {
      updates["password"] = await bcrypt.hash(updates["password"] as string, 10);
    }

    const updated = await this.userRepo.update(userId, updates);

    await this.activityRepo.logActivity({
      userId: callerUserId,
      action: "update_user",
      details: { targetUserId: userId },
      module: "users",
      entityType: callerIsAdmin ? "system" : "user",
    });

    getEventBus().emit("user_updated", { userId, updatedBy: callerUserId });

    return this.sanitizeUser(updated as Record<string, unknown>);
  }

  async deleteUser(userId: number, callerUserId: number, callerIsAdmin: boolean) {
    this.preventSelfAction(callerUserId, userId, "delete");
    if (!callerIsAdmin) throw new Error("Unauthorized: admin only");

    const user = await this.userRepo.getById(userId);
    if (!user) throw new Error("User not found");

    await this.sessionRepo.terminateAllUserSessions(userId);

    const avatar = (user as Record<string, unknown>)["avatar"];
    if (typeof avatar === "string" && avatar.startsWith("/assets/images/avatars/")) {
      try {
        await unlink(path.join(process.cwd(), "public", avatar.replace(/^\//, "")));
      } catch {
        // avatar file may already be gone — ignore
      }
    }

    await this.userRepo.delete(userId);

    await this.activityRepo.logActivity({
      userId: callerUserId,
      action: "delete_user",
      details: { targetUserId: userId },
      module: "users",
      entityType: "system",
    });

    getEventBus().emit("user_deleted", { userId, deletedBy: callerUserId });

    return this.sanitizeUser(user as Record<string, unknown>);
  }

  async getUserById(userId: number) {
    const user = await this.userRepo.getById(userId);
    if (!user) throw new Error("User not found");
    return this.sanitizeUser(user as Record<string, unknown>);
  }

  async blockUser(userId: number, block: boolean, callerUserId: number, callerIsAdmin: boolean) {
    this.preventSelfAction(callerUserId, userId, "block");
    if (!callerIsAdmin) throw new Error("Unauthorized: admin only");

    const user = await this.userRepo.getById(userId);
    if (!user) throw new Error("User not found");
    await this.userRepo.blockUser(userId, block);

    await this.activityRepo.logActivity({
      userId: callerUserId,
      action: block ? "block_user" : "unblock_user",
      details: { targetUserId: userId },
      module: "users",
      entityType: "system",
    });

    await this.securityRepo.logSecurityEvent({
      userId: callerUserId,
      eventType: block ? "user_blocked" : "user_unblocked",
      details: { targetUserId: userId },
    });

    return true;
  }

  async changeAdminStatus(
    userId: number,
    makeAdmin: boolean,
    callerUserId: number,
    callerIsAdmin: boolean,
  ) {
    this.preventSelfAction(callerUserId, userId, "change admin status of");
    if (!callerIsAdmin) throw new Error("Unauthorized: admin only");

    const user = await this.userRepo.getById(userId);
    if (!user) throw new Error("User not found");
    await this.userRepo.update(userId, { is_admin: makeAdmin ? 1 : 0 });

    await this.activityRepo.logActivity({
      userId: callerUserId,
      action: makeAdmin ? "grant_admin" : "revoke_admin",
      details: { targetUserId: userId },
      module: "users",
      entityType: "system",
    });

    return true;
  }

  async getAllUsers(limit = 50, offset = 0) {
    const result = await this.userRepo.getUsersWithStats(limit, offset);
    return {
      ...result,
      rows: result.rows.map((u) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pw, ...safe } = u as Record<string, unknown>;
        return safe;
      }),
    };
  }

  async searchUsers(query: string) {
    const users = await this.userRepo.searchUsers(query);
    return users.map((u) => this.sanitizeUser(u as Record<string, unknown>));
  }

  async getSystemStats() {
    return this.userRepo.getSystemStats();
  }

  async getVisitors(limit = 50, offset = 0) {
    const db = await this.userRepo.getDb();
    return db.all(`SELECT * FROM visitors ORDER BY last_seen DESC LIMIT ? OFFSET ?`, [
      limit,
      offset,
    ]);
  }

  async blockVisitor(visitorId: number, block: boolean) {
    const db = await this.userRepo.getDb();
    await db.run("UPDATE visitors SET is_blocked = ? WHERE id = ?", [block ? 1 : 0, visitorId]);
    return true;
  }

  async deleteVisitor(visitorId: number) {
    const db = await this.userRepo.getDb();
    await db.run("DELETE FROM visitors WHERE id = ?", [visitorId]);
    return true;
  }

  async getUserSessions(userId: number) {
    const db = await this.userRepo.getDb();
    return db.all("SELECT * FROM user_sessions WHERE user_id = ? ORDER BY last_active DESC", [
      userId,
    ]);
  }

  async deleteUserSessions(userId: number) {
    return this.sessionRepo.terminateAllUserSessions(userId);
  }

  async logActivity(params: {
    userId?: number | null;
    deviceId?: string | null;
    action: string;
    targetId?: number | null;
    details?: unknown;
    ip?: string | null;
    userAgent?: string | null;
    module?: string;
  }) {
    return this.activityRepo.logActivity(params);
  }

  async getRecentActivities(limit = 30) {
    return this.activityRepo.getRecentActivities(limit);
  }

  async getUserActivity(userId: number, limit = 50) {
    return this.activityRepo.getUserActivities(userId, limit);
  }

  async getUserStats(userId: number) {
    const db = await this.userRepo.getDb();

    const watched = (await db.get(
      "SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND is_finished = 1",
      [userId],
    )) as { count: number } | undefined;
    const inProgress = (await db.get(
      "SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND is_finished = 0",
      [userId],
    )) as { count: number } | undefined;
    const totalSessions = (await db.get(
      "SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ?",
      [userId],
    )) as { count: number } | undefined;
    const activeSessions = (await db.get(
      "SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ? AND is_active = 1",
      [userId],
    )) as { count: number } | undefined;
    const lastActive = (await db.get(
      "SELECT MAX(last_active) as last_active FROM user_sessions WHERE user_id = ?",
      [userId],
    )) as { last_active: string | null } | undefined;

    return {
      watched_count: watched?.count ?? 0,
      in_progress_count: inProgress?.count ?? 0,
      total_sessions: totalSessions?.count ?? 0,
      active_sessions: activeSessions?.count ?? 0,
      last_active: lastActive?.last_active ?? null,
    };
  }

  /**
   * Persists an uploaded avatar image under `public/assets/images/avatars`,
   * stores its public URL in the `users.avatar` column, and removes any
   * previous avatar file for the same user.
   *
   * @param userId - The target user id.
   * @param file - The uploaded image file (must be an image MIME type).
   * @param actorUserId - The admin id performing the upload (the real actor,
   *   distinct from the affected `userId`).
   * @returns The public URL of the saved avatar.
   * @throws When the user does not exist or the file is not an image.
   */
  async uploadAvatar(userId: number, file: File, actorUserId: number) {
    const user = await this.userRepo.getById(userId);
    if (!user) throw new Error("User not found");

    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";

    const dir = AVATARS_DIR;
    await mkdir(dir, { recursive: true });
    const filename = `avatar_${userId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
    await writeFile(path.join(dir, filename), bytes);

    const avatarUrl = `/assets/images/avatars/${filename}`;

    const existing = (user as Record<string, unknown>)["avatar"];
    if (typeof existing === "string" && existing.startsWith("/assets/images/avatars/")) {
      try {
        await unlink(path.join(process.cwd(), "public", existing.replace(/^\//, "")));
      } catch {
        // previous avatar file may already be gone — ignore
      }
    }

    await this.userRepo.update(userId, { avatar: avatarUrl });

    await this.activityRepo.logActivity({
      userId: userId,
      actorUserId,
      action: "update_avatar",
      details: { avatar: avatarUrl },
      module: "users",
    });

    return avatarUrl;
  }

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

  async getSecurityEventsByUser(userId: number, limit = 30) {
    return this.securityRepo.getUserSecurityEvents(userId, limit);
  }

  async resolveSecurityEvent(eventId: number, resolvedByUserId: number) {
    return this.securityRepo.resolveSecurityEvent(eventId, resolvedByUserId);
  }

  private sanitizeUser(user: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...safe } = user;
    return {
      user_id: safe["user_id"],
      username: safe["username"],
      display_name: safe["display_name"],
      email: safe["email"],
      is_admin: (safe["is_admin"] as number) === 1,
      created_at: safe["created_at"],
      last_active: safe["last_active"],
      avatar: safe["avatar"] ?? null,
    };
  }
}
