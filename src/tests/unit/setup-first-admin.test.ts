import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getDatabase } from "@/backend/db/db";
import { UserRepository } from "@/backend/repositories/user-repository";
import { UserSessionRepository } from "@/backend/repositories/session-repository";
import { ActivityRepository } from "@/backend/repositories/activity-repository";
import { SecurityEventRepository } from "@/backend/repositories/security-repository";
import { LoginAttemptRepository } from "@/backend/repositories/login-attempt-repository";
import {
  SetupService,
  SETUP_ALREADY_INITIALIZED,
  type SanitizedFirstAdmin,
} from "@/backend/services/setup-service";
import { AuthService } from "@/backend/services/auth-service";

/** مستودعات مشتركة بين الاختبارات (تُفرَّغ صفوفها قبل كل حالة). */
const userRepo = new UserRepository();
const sessionRepo = new UserSessionRepository();
const activityRepo = new ActivityRepository();
const securityRepo = new SecurityEventRepository();
const loginAttemptRepo = new LoginAttemptRepository();

/** الخدمة قيد الاختبار — تُبنى يدوياً لعزلها عن جدولة `getServices()`. */
const setupService = new SetupService(userRepo, activityRepo, securityRepo);

/** خدمة المصادقة القائمة للتحقق من تسجيل دخول المدير الجديد عبر المسار الرسمي. */
const authService = new AuthService(
  userRepo,
  sessionRepo,
  activityRepo,
  securityRepo,
  loginAttemptRepo,
);

/**
 * يفرّغ جداول المستخدمين والتدقيق لضمان عزل كل حالة اختبار على نفس قاعدة
 * البيانات العائمة (`:memory:`) دون إعادة تنفيذ الـ migrations.
 */
async function resetTables(): Promise<void> {
  const db = await getDatabase();
  await db.run("DELETE FROM users");
  await db.run("DELETE FROM user_sessions");
  await db.run("DELETE FROM login_attempts");
  await db.run("DELETE FROM activities");
  await db.run("DELETE FROM security_events");
}

describe("SetupService — first-admin bootstrap (B2)", () => {
  beforeEach(async () => {
    await resetTables();
  });

  it("1. fresh install reports initialized=false", async () => {
    const status = await setupService.getStatus();
    expect(status.initialized).toBe(false);
  });

  it("2. createFirstAdmin succeeds and returns sanitized user (no password)", async () => {
    const result = await setupService.createFirstAdmin(
      { username: "admin", password: "Secret#123" },
      "::1",
      "vitest",
    );
    expect(result.username).toBe("admin");
    expect((result as Record<string, unknown>)["password"]).toBeUndefined();
    expect((result as SanitizedFirstAdmin)["is_admin"]).toBe(1);
  });

  it("3. created row has is_admin=1 in the database", async () => {
    await setupService.createFirstAdmin(
      { username: "admin", password: "Secret#123" },
      "::1",
      "vitest",
    );
    const row = (await userRepo.findByUsername("admin")) as { is_admin: number };
    expect(row.is_admin).toBe(1);
  });

  it("4. stored password is bcrypt-hashed, never plaintext", async () => {
    await setupService.createFirstAdmin(
      { username: "admin", password: "Secret#123" },
      "::1",
      "vitest",
    );
    const row = (await userRepo.findByUsername("admin")) as { password: string };
    expect(row.password.startsWith("$2")).toBe(true);
    expect(row.password).not.toBe("Secret#123");
  });

  it("5. status flips to initialized=true after creation", async () => {
    await setupService.createFirstAdmin(
      { username: "admin", password: "Secret#123" },
      "::1",
      "vitest",
    );
    const status = await setupService.getStatus();
    expect(status.initialized).toBe(true);
  });

  it("6. second creation attempt is rejected with SETUP_ALREADY_INITIALIZED", async () => {
    await setupService.createFirstAdmin(
      { username: "admin", password: "Secret#123" },
      "::1",
      "vitest",
    );
    await expect(
      setupService.createFirstAdmin({ username: "other", password: "x" }, "::1", "vitest"),
    ).rejects.toThrow(SETUP_ALREADY_INITIALIZED);
  });

  it("7. pre-existing non-admin blocks setup and is NOT promoted", async () => {
    await userRepo.create({
      username: "plainuser",
      password: "$2a$10$placeholderhashplaceholderhashplaceholderhas",
      email: null,
      display_name: "plainuser",
      is_admin: 0,
      is_blocked: 0,
    });
    await expect(
      setupService.createFirstAdmin({ username: "hacker", password: "x" }, "::1", "vitest"),
    ).rejects.toThrow(SETUP_ALREADY_INITIALIZED);
    const row = (await userRepo.findByUsername("plainuser")) as { is_admin: number };
    expect(row.is_admin).toBe(0);
  });

  it("8. two concurrent attempts create exactly ONE admin", async () => {
    const [a, b] = await Promise.allSettled([
      setupService.createFirstAdmin({ username: "adminA", password: "Secret#123" }, "::1", "vitest"),
      setupService.createFirstAdmin({ username: "adminB", password: "Secret#456" }, "::1", "vitest"),
    ]);
    const fulfilled = [a, b].filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(1);
    const admins = await activityRepo.query(
      "SELECT COUNT(*) as count FROM users WHERE is_admin = 1",
    );
    expect((admins[0] as { count: number }).count).toBe(1);
  });

  it("9. new admin logs in via existing /api/auth login flow (AuthService)", async () => {
    await setupService.createFirstAdmin(
      { username: "admin", password: "Secret#123" },
      "::1",
      "vitest",
    );
    const result = await authService.login("admin", "Secret#123", "::1", "vitest");
    expect(typeof result.token).toBe("string");
    expect(result.user.is_admin).toBe(true);
    expect(result.user.username).toBe("admin");
  });

  it("10. JWT payload of the new admin carries is_admin=true (verify-admin gate input)", async () => {
    await setupService.createFirstAdmin(
      { username: "admin", password: "Secret#123" },
      "::1",
      "vitest",
    );
    const { token } = await authService.login("admin", "Secret#123", "::1", "vitest");
    const payload = authService.verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.["is_admin"]).toBe(true);
  });

  it("11. public registration remains unavailable (no register route exists)", () => {
    const registerRoute = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "auth",
      "register",
    );
    expect(fs.existsSync(registerRoute)).toBe(false);
  });

  it("12. tests run on an isolated in-memory database (dev data untouched)", async () => {
    const db = await getDatabase();
    const filename = String(db["config"]?.["filename"] ?? "");
    // db.ts يحول :memory: إلى shared-memory URI داخلي — كلاهما بلا ملف على القرص.
    expect(filename.includes(":memory:") || filename.includes("mode=memory")).toBe(true);
  });
});
