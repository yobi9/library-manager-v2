import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/user-repository";
import { UserSessionRepository } from "../repositories/session-repository";
import { ActivityRepository } from "../repositories/activity-repository";
import { SecurityEventRepository } from "../repositories/security-repository";
import { LoginAttemptRepository } from "../repositories/login-attempt-repository";
import { getEventBus } from "./event-bus";
import { withClientWriteFailFast } from "../db/db";

const JWT_SECRET = process.env["JWT_SECRET"] as string;
if (!JWT_SECRET) {
  throw new Error(
    "[FATAL] JWT_SECRET must be set in environment variables. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
  );
}
const TOKEN_EXPIRY = 2 * 60 * 60; // 2 hours in seconds

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export interface AuthUser {
  user_id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  last_active: string | null;
}

export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private sessionRepo: UserSessionRepository,
    private activityRepo: ActivityRepository,
    private securityRepo: SecurityEventRepository,
    private loginAttemptRepo: LoginAttemptRepository,
    /** اختياري: مسند يعيد `true` عندما يكون مسح نشط (يتخطى تنظيف الدخول حينها). */
    private getIsScanActive?: () => boolean,
  ) {
    // تنظيف دوري لصفوف محاولات الدخول المنتهية نافذة قفلها (منع نمو الجدول).
    setInterval(() => {
      // تخطّي التنظيف أثناء مسح نشط: كتابة الحذف تتنافس مع كاتب الماسح على
      // قفل كتابة WAL وتنتهي بـ SQLITE_BUSY — الحذف يتأجل لدورة لاحقة فقط.
      if (this.getIsScanActive?.() === true) return;
      void this.loginAttemptRepo
        .deleteExpired(Date.now() - LOCKOUT_DURATION_MS)
        .catch((err: Error) => {
          console.error("[AuthService] Failed to clean expired login attempts:", err.message);
        });
    }, CLEANUP_INTERVAL_MS).unref();
  }

  async login(username: string, password: string, ip: string, userAgent: string) {
    if (!username || !password) throw new Error("Username and password are required");

    const attempt = await this.loginAttemptRepo.get(username);
    if (attempt && attempt.attempt_count >= MAX_LOGIN_ATTEMPTS) {
      const elapsed = Date.now() - attempt.locked_at;
      if (elapsed < LOCKOUT_DURATION_MS) {
        const remaining = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 60000);
        await this.logFailedLogin({
          username,
          reason: "account_locked",
          ip,
          userAgent,
        });
        throw new Error(`Account locked. Try again in ${remaining} minute(s)`);
      }
      // انتهت نافذة القفل — تصفير العداد للمتابعة من الصفر.
      await this.loginAttemptRepo.clear(username);
    }

    const user = (await this.userRepo.findByUsername(username)) as
      | {
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
      | undefined;

    if (!user) {
      await this.loginAttemptRepo.increment(username);
      await this.logFailedLogin({ username, reason: "user_not_found", ip, userAgent });
      throw new Error("Invalid credentials");
    }

    const isMatch = await this.verifyPassword(password, user.password);
    if (!isMatch) {
      await this.loginAttemptRepo.increment(username);
      await this.logFailedLogin({
        username,
        userId: user.user_id,
        reason: "invalid_password",
        ip,
        userAgent,
      });
      throw new Error("Invalid credentials");
    }

    await this.loginAttemptRepo.clear(username);

    if (user.is_blocked) throw new Error("Account is blocked");

    if (!user.password.startsWith("$2")) {
      const newHash = await bcrypt.hash(password, 10);
      await this.userRepo.update(user.user_id, { password: newHash });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        is_admin: user.is_admin === 1,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY },
    );

    try {
      // إنشاء الجلسة وتوثيق نشاط الدخول كتابات على الاتصال الرئيسي قد تتنازع
      // مع كاتب الماسح أثناء مسح قيد التنفيذ (`SQLITE_BUSY`). وضع الفشل السريع
      // (بند العزل 3.5.4) يخفض `busy_timeout` مؤقتاً إلى 200ms بحيث تنتهي
      // الكتابة إما بنجاح سريع أو برفض سريع بدل الانتظار 30 ثانية: فلو فشل
      // إنشاء صف الجلسة سيبدو الدخول "ناجحاً" (JWT صدر) لكن الطلبات اللاحقة
      // ستفشل — وهو السبب الجذري لفشل الدخول العابر المُلاحَظ أثناء المسح.
      await withClientWriteFailFast(() =>
        this.sessionRepo.createSession({
          userId: user.user_id,
          ip,
          userAgent,
          os: this.detectOS(userAgent),
        }),
      );
      await withClientWriteFailFast(() =>
        this.activityRepo.logActivity({
          userId: user.user_id,
          action: "user_login",
          details: { username },
          ip,
          userAgent,
          module: "auth",
          entityType: user.is_admin === 1 ? "system" : "user",
        }),
      );
    } catch (err) {
      console.error("Login post-processing error (non-fatal):", err);
    }

    getEventBus().emit("user_login", {
      userId: user.user_id,
      username: user.username,
      ip,
      userAgent,
    });

    return { token, user: this.sanitizeUser(user) };
  }

  async logout(userId: number, ip: string, userAgent: string) {
    await this.sessionRepo.terminateAllUserSessions(userId);
    const user = (await this.userRepo.getById(userId)) as { is_admin: number } | undefined;
    await this.activityRepo.logActivity({
      userId,
      action: "logout",
      ip,
      userAgent,
      module: "auth",
      entityType: user?.is_admin === 1 ? "system" : "user",
    });
    getEventBus().emit("user_logout", { userId, ip, userAgent });
    return true;
  }

  async getCurrentUser(userId: number) {
    const user = (await this.userRepo.getById(userId)) as Record<string, unknown> | undefined;
    if (!user) throw new Error("User not found");
    return this.sanitizeUser(user);
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    ip: string,
    userAgent: string,
  ) {
    if (!currentPassword || !newPassword) throw new Error("Current and new password are required");
    if (newPassword.length < 6) throw new Error("New password must be at least 6 characters");

    const user = (await this.userRepo.getById(userId)) as
      | {
          password: string;
        }
      | undefined;
    if (!user) throw new Error("User not found");

    const isMatch = await this.verifyPassword(currentPassword, user.password);
    if (!isMatch) throw new Error("Current password is incorrect");

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(userId, { password: hashed });

    await this.logPasswordChanged(userId, ip, userAgent);

    return true;
  }

  async register(
    userData: {
      username: string;
      password: string;
      email?: string;
      display_name?: string;
    },
    ip: string,
    userAgent: string,
  ) {
    const { username, password, email, display_name } = userData;
    if (!username || !password) throw new Error("Username and password are required");

    const existing = await this.userRepo.findByUsername(username);
    if (existing) throw new Error("Username already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = (await this.userRepo.create({
      username,
      password: hashedPassword,
      email: email ?? null,
      display_name: display_name || username,
      is_admin: 0,
      is_blocked: 0,
    })) as Record<string, unknown>;

    await this.activityRepo.logActivity({
      userId: newUser["user_id"] as number,
      action: "register",
      details: { username },
      ip,
      userAgent,
      module: "auth",
    });

    return this.sanitizeUser(newUser);
  }

  verifyToken(token: string): jwt.JwtPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    } catch {
      return null;
    }
  }

  async hasActiveSession(userId: number): Promise<boolean> {
    const sessions = await this.sessionRepo.getUserActiveSessions(userId);
    return sessions.length > 0;
  }

  async getTotalUsers(): Promise<number> {
    return this.userRepo.getTotalUsers();
  }

  /**
   * يسجّل محاولة دخول فاشلة في `security_events` بدرجة `warning` بأمان:
   * أي خطأ أثناء التسجيل لا يمنع إكمال رفض الدخول (لا نسمح لفشل سجل
   * أمني بفتح ثغرة DoS أو تغيير سلوك المصادقة).
   *
   * @param opts.username - اسم المستخدم الذي حاول الدخول.
   * @param opts.userId - معرّف المستخدم إن وُجد (حالة كلمة مرور خاطئة فقط).
   * @param opts.reason - سبب الرفض: `user_not_found` | `invalid_password` | `account_locked`.
   * @param opts.ip - عنوان IP القادم من الطلب.
   * @param opts.userAgent - وكيل المتصفح من الطلب.
   * @returns لا يُرجع قيمة؛ الفشل يُسجَّل في الـ console فقط.
   */
  private async logFailedLogin(opts: {
    username: string;
    userId?: number;
    reason: "user_not_found" | "invalid_password" | "account_locked";
    ip: string;
    userAgent: string;
  }): Promise<void> {
    try {
      await this.securityRepo.logSecurityEvent({
        userId: opts.userId,
        eventType: "login_failed",
        severity: "warning",
        details: { username: opts.username, reason: opts.reason },
        ip: opts.ip,
        userAgent: opts.userAgent,
      });
    } catch (err) {
      console.error("[AuthService] Failed to log login_failed:", err);
    }
  }

  /**
   * يسجّل تغيير كلمة المرور بنجاح في `security_events` بأمان: أي فشل في
   * التسجيل يُطبَع فقط ولا يعطّل عملية تغيير كلمة المرور نفسها.
   *
   * @param userId - معرّف المستخدم الذي غيّر كلمته.
   * @param ip - عنوان IP الخاص بالطلب.
   * @param userAgent - وكيل المتصفح الخاص بالطلب.
   * @returns لا يُرجع قيمة؛ الفشل يُسجَّل في الـ console فقط.
   */
  private async logPasswordChanged(userId: number, ip: string, userAgent: string): Promise<void> {
    try {
      await this.securityRepo.logSecurityEvent({
        userId,
        eventType: "password_changed",
        severity: "info",
        ip,
        userAgent,
      });
    } catch (err) {
      console.error("[AuthService] Failed to log password_changed:", err);
    }
  }

  private async verifyPassword(plain: string, hashed: string): Promise<boolean> {
    if (!hashed || !hashed.startsWith("$2")) return false;
    return bcrypt.compare(plain, hashed);
  }

  private sanitizeUser(user: Record<string, unknown>): AuthUser {
    return {
      user_id: user["user_id"] as number,
      username: user["username"] as string,
      display_name: (user["display_name"] as string) ?? null,
      email: (user["email"] as string) ?? null,
      is_admin: (user["is_admin"] as number) === 1,
      created_at: (user["created_at"] as string) ?? "",
      last_active: (user["last_active"] as string) ?? null,
    };
  }

  private detectOS(userAgent: string | null): string {
    if (!userAgent) return "unknown";
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Mac")) return "MacOS";
    if (userAgent.includes("Linux")) return "Linux";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
    return "unknown";
  }
}
