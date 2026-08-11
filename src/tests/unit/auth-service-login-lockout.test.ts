/**
 * اختبارات وحدة لتدفق تسجيل الدخول وقفل الحساب في `AuthService`.
 *
 * الغاية: تأمين سلوك حارس محاولات الدخول الجديد المعتمد على قاعدة البيانات
 * (الحد الأقصى = 5 محاولات، نافذة قفل = 15 دقيقة، التصفير بعد النجاح أو
 * انتهاء النافذة). جميع المستودعات وهمية — لا تُمَس قاعدة بيانات فعلية.
 *
 * ملاحظة: `auth-service.ts` يقرأ `JWT_SECRET` وقت التحميل؛ يضمنه
 * `src/tests/setup.ts`.
 */
import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import type { ActivityRepository } from "@/backend/repositories/activity-repository";
import type {
  LoginAttemptRepository,
  LoginAttemptRow,
} from "@/backend/repositories/login-attempt-repository";
import type { SecurityEventRepository } from "@/backend/repositories/security-repository";
import type { UserSessionRepository } from "@/backend/repositories/session-repository";
import type { UserRepository } from "@/backend/repositories/user-repository";
import { AuthService } from "@/backend/services/auth-service";

/** الشكل الذي يقرأه `AuthService.login` من مستخدم. */
interface TestUser {
  user_id: number;
  username: string;
  password: string;
  display_name: string | null;
  is_admin: number;
  is_blocked: number;
  email: string | null;
  created_at: string;
  last_active: string | null;
}

interface Harness {
  service: AuthService;
  userRepo: UserRepository;
  sessionRepo: UserSessionRepository;
  activityRepo: ActivityRepository;
  securityRepo: SecurityEventRepository;
  attemptRepo: LoginAttemptRepository;
}

/**
 * يبني نموذجاً من `AuthService` بمستودعات وهمية مع سيطرة على استجاباتها.
 *
 * @param opts.user - المستخدم الذي تُرجعه `findByUsername`/`getById` (أو undefined).
 * @param opts.attempt - صف محاولات الدخول الذي تُرجعه `attemptRepo.get` (أو undefined).
 * @returns مرجع للخدمة وكل المستودعات الوهمية لفحص الاستدعاءات.
 */
function createHarness(
  opts: { user?: TestUser | null; attempt?: LoginAttemptRow | null } = {},
): Harness {
  const userRepo = {
    findByUsername: vi.fn(async () => opts.user ?? undefined),
    getById: vi.fn(async () => opts.user ?? undefined),
    update: vi.fn(async () => undefined),
    create: vi.fn(async () => ({})),
    getTotalUsers: vi.fn(async () => 0),
  } as unknown as UserRepository;

  const sessionRepo = {
    createSession: vi.fn(async () => ({})),
    terminateAllUserSessions: vi.fn(async () => undefined),
    getUserActiveSessions: vi.fn(async () => []),
  } as unknown as UserSessionRepository;

  const activityRepo = {
    logActivity: vi.fn(async () => ({})),
  } as unknown as ActivityRepository;

  const securityRepo = {
    logSecurityEvent: vi.fn(async () => ({})),
  } as unknown as SecurityEventRepository;

  const attemptRepo = {
    get: vi.fn(async () => opts.attempt ?? undefined),
    increment: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    deleteExpired: vi.fn(async () => undefined),
  } as unknown as LoginAttemptRepository;

  const service = new AuthService(userRepo, sessionRepo, activityRepo, securityRepo, attemptRepo);

  return { service, userRepo, sessionRepo, activityRepo, securityRepo, attemptRepo };
}

/** يبني مستخدم اختبار بمعرّف طبيعي وهاتجه مبنياً من كلمة المرور المقدمة. */
function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    user_id: 1,
    username: "admin",
    password: bcrypt.hashSync("correct-password", 4),
    display_name: "Admin",
    is_admin: 1,
    is_blocked: 0,
    email: null,
    created_at: "2025-01-01 00:00:00",
    last_active: null,
    ...overrides,
  };
}

const IP = "1.2.3.4";
const USER_AGENT = "Vitest/1.0";

describe("AuthService.login", () => {
  it("ينجح بكلمة مرور صحيحة، يصفّر العداد وينشئ الجلسة ويسجّل النشاط", async () => {
    const { service, attemptRepo, sessionRepo, activityRepo } = createHarness({ user: makeUser() });

    const result = await service.login("admin", "correct-password", IP, USER_AGENT);

    expect(result.token).toBeTruthy();
    expect(result.user.username).toBe("admin");
    expect(attemptRepo.clear).toHaveBeenCalledWith("admin");
    expect(sessionRepo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, ip: IP, userAgent: USER_AGENT }),
    );
    expect(activityRepo.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user_login",
        module: "auth",
        details: { username: "admin" },
      }),
    );
  });

  it("يرفض كلمة مرور خاطئة، يزيد العداد ويُسجّل حدثاً أمنياً", async () => {
    const { service, attemptRepo, securityRepo } = createHarness({ user: makeUser() });

    await expect(service.login("admin", "wrong-password", IP, USER_AGENT)).rejects.toThrow(
      "Invalid credentials",
    );
    expect(attemptRepo.increment).toHaveBeenCalledWith("admin");
    expect(securityRepo.logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "login_failed",
        severity: "warning",
        details: { username: "admin", reason: "invalid_password" },
      }),
    );
  });

  it("يزيد العداد عند حساب غير موجود ويسجّل سبب user_not_found", async () => {
    const { service, attemptRepo, securityRepo } = createHarness({ user: null });

    await expect(service.login("ghost", "password", IP, USER_AGENT)).rejects.toThrow(
      "Invalid credentials",
    );
    expect(attemptRepo.increment).toHaveBeenCalledWith("ghost");
    expect(securityRepo.logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "login_failed",
        severity: "warning",
        details: { username: "ghost", reason: "user_not_found" },
      }),
    );
  });

  it("يقفل الحساب عند بلوغ الحد داخل النافذة دون زيادة العداد", async () => {
    const { service, attemptRepo, securityRepo } = createHarness({
      user: makeUser(),
      attempt: {
        username: "admin",
        attempt_count: 5,
        locked_at: Date.now() - 1000,
        last_failed_at: Date.now(),
      },
    });

    await expect(service.login("admin", "correct-password", IP, USER_AGENT)).rejects.toThrow(
      "Account locked",
    );
    expect(attemptRepo.increment).not.toHaveBeenCalled();
    expect(securityRepo.logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "login_failed",
        severity: "warning",
        details: { username: "admin", reason: "account_locked" },
      }),
    );
  });

  it("يصفّر العداد ويسمح بالمحاولة عند انتهاء نافذة القفل", async () => {
    const { service, attemptRepo } = createHarness({
      user: makeUser(),
      attempt: {
        username: "admin",
        attempt_count: 5,
        locked_at: Date.now() - 16 * 60 * 1000,
        last_failed_at: Date.now(),
      },
    });

    const result = await service.login("admin", "correct-password", IP, USER_AGENT);
    expect(result.token).toBeTruthy();
    expect(attemptRepo.clear).toHaveBeenCalledWith("admin");
  });

  it("يرفض الدخول لحساب موقوف حتى مع كلمة مرور صحيحة", async () => {
    const { service } = createHarness({ user: makeUser({ is_blocked: 1 }) });

    await expect(service.login("admin", "correct-password", IP, USER_AGENT)).rejects.toThrow(
      "Account is blocked",
    );
  });

  it("يرفض المدخلات الفارغة دون لمس المستودعات", async () => {
    const { service, userRepo, attemptRepo } = createHarness();

    await expect(service.login("", "", IP, USER_AGENT)).rejects.toThrow(
      "Username and password are required",
    );
    expect(userRepo.findByUsername).not.toHaveBeenCalled();
    expect(attemptRepo.increment).not.toHaveBeenCalled();
  });
});
