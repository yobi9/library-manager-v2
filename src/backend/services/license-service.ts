import { createVerify } from "node:crypto";
import { readFile, writeFile, unlink, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { ActivityRepository } from "../repositories/activity-repository";
import { logger } from "../observability/logger";
import { ensureDirs } from "../utils/path-utils";

/**
 * Parsed `.lic` license payload. The `signature` field is a base64 RSA-SHA256
 * signature over the canonicalized payload (all fields except `signature`,
 * sorted by key). Mirrors the license format issued by the publisher and
 * consumed by the old project's `LicenseClient`.
 */
interface LicenseData {
  licenseKey: string;
  clientName: string;
  expiryDate?: string | null;
  features?: string[];
  issuedAt?: string | null;
  signature: string;
  [key: string]: unknown;
}

/** Result of a single verification pass over a license payload. */
interface VerifyResult {
  valid: boolean;
  reason?: string;
  message?: string;
  licenseKey?: string;
  clientName?: string;
  expiryDate?: string | null;
  features?: string[];
  issuedAt?: string | null;
}

/** Outcome of an activation attempt (success + persisted data or failure reason). */
export interface LicenseActivationResult {
  success: boolean;
  reason?: string;
  message?: string;
  data?: {
    clientName: string;
    expiryDate: string | null;
    features: string[];
  };
}

/** Current license state exposed to the admin license page. */
export interface LicenseStatus {
  activated: boolean;
  licenseKey: string | null;
  clientName: string | null;
  expiryDate: string | null;
  features: string[] | null;
  reason: string | null;
  message: string | null;
}

/** Outcome of a refresh attempt (reload from disk). */
export interface LicenseRefreshResult {
  success: boolean;
  data: {
    activated: boolean;
    clientName: string | null;
    expiryDate: string | null;
    reason: string | null;
  };
}

/** Embedded RSA public key used to verify license signatures. */
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzHtXCPY5NWhrO97bhDiF
A6bUgssowogCv/H3PBl5HMlX7TmwsPUp6ExAWRuEjRdMK8UkiOIcXeLJ2yNJxmSM
Xy9kL8m0LodO3daYJR1m4NltbOVE9A9fd0rjn7Q1lKAb7a3sbxfEOks40GGXcKE3
p3mpRvZ2RgCm4VK0ODCAgPzN6pZFYdRC5arWVTTMqGtUlIbsTyabIP7T2hIYB31p
a9gThZY2DjwTEGPSadHmTqS779w1OerX15EpvH/rhcrlooAfsNZmwCLYgSeCmXVw
98dl7uHoC9iD+Fg1k1ejSX9Krpo4jaJYi08Urc12zP/vhpSdG6uGN/Lf+Fa/ITmR
uwIDAQAB
-----END PUBLIC KEY-----`;

/** Directory holding the persisted `.lic` file (project root `data/licenses`). */
const LICENSE_DIR = path.join(process.cwd(), "data", "licenses");

/** Persisted license file path. */
const LICENSE_PATH = path.join(LICENSE_DIR, "license.lic");

/**
 * Serializes a license payload exactly as the publisher did before signing:
 * all keys except `signature`, sorted alphabetically, with null/string/number/
 * boolean/array values rendered canonically. Byte-for-byte parity is required
 * so existing signed `.lic` files keep verifying.
 *
 * @param data - Full license payload including the `signature` field.
 * @returns The canonical unsigned JSON string that was signed by the publisher.
 */
function canonicalizeWithoutSignature(data: Record<string, unknown>): string {
  const obj = { ...data };
  delete obj["signature"];
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => {
    const v = obj[k];
    if (v === null || v === undefined) return `"${k}":null`;
    if (typeof v === "string") return `"${k}":"${v}"`;
    if (typeof v === "number" || typeof v === "boolean") return `"${k}":${v}`;
    if (Array.isArray(v)) return `"${k}":${JSON.stringify(v)}`;
    return `"${k}":"${String(v)}"`;
  });
  return "{" + parts.join(",") + "}";
}

/** Masks a license key for display, keeping only the first 8 characters. */
function maskLicenseKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 8)}****` : key;
}

/**
 * Validates and persists publisher-signed `.lic` licenses.
 *
 * Behavior parity with the old project's `LicenseClient`: a license is valid
 * when the RSA signature over the canonicalized payload matches AND (when an
 * `expiryDate` is present) the license has not expired. Persisted to
 * `data/licenses/license.lic`. In-memory state is re-evaluated on every call.
 */
export class LicenseService {
  private licenseData: LicenseData | null = null;
  private valid = false;

  constructor(private activityRepo?: ActivityRepository) {
    // إنشاء مجلد التراخيص `data/licenses` عند بدء التشغيل (أول بناء للخدمة)
    // ليكون جاهزاً قبل أي `activate`/`activateFile` — الفشل يُسجَّل فقط.
    void this.ensureDirectories();
  }

  /**
   * يضمن وجود مجلد حفظ ملف الترخيص `data/licenses` (ثابت نسبي لجذر المشروع،
   * بلا إعداد مؤثر عليه).
   *
   * - السلوك: لا يرمي الخطأ أبداً — الفشل يُسجَّل عبر `logger` فقط.
   *
   * @returns وعد ينجز عند ضمان وجود المجلد (أو تسجيل الفشل).
   */
  async ensureDirectories(): Promise<void> {
    try {
      await ensureDirs([LICENSE_DIR], "LicenseService");
    } catch (err) {
      logger.error("license.dirs_ensure_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Loads a license payload from a JSON string, verifies it, and keeps the
   * result in memory.
   *
   * @param jsonString - Raw JSON content of the `.lic` file.
   * @returns The verification outcome.
   */
  async loadFromData(jsonString: string): Promise<VerifyResult> {
    let data: LicenseData;
    try {
      data = JSON.parse(jsonString) as LicenseData;
    } catch (err) {
      return {
        valid: false,
        reason: "PARSE_ERROR",
        message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (!data.signature) {
      return { valid: false, reason: "NO_SIGNATURE", message: "License file has no signature" };
    }
    if (!data.licenseKey || !data.clientName) {
      return {
        valid: false,
        reason: "INVALID_FORMAT",
        message: "License file missing required fields (licenseKey, clientName)",
      };
    }
    this.licenseData = data;
    return this.verify();
  }

  /**
   * Verifies the currently loaded license against the embedded public key and
   * (when present) its expiry date.
   *
   * @returns `valid: true` with the license fields, or a failure reason/message.
   */
  verify(): VerifyResult {
    if (!this.licenseData) {
      return { valid: false, reason: "NO_DATA", message: "No license data loaded" };
    }

    const signature = this.licenseData.signature;
    const payload = canonicalizeWithoutSignature(this.licenseData);
    const verifier = createVerify("sha256");
    verifier.update(payload);
    verifier.end();
    const sigValid = verifier.verify(PUBLIC_KEY, signature, "base64");

    if (!sigValid) {
      this.valid = false;
      return {
        valid: false,
        reason: "SIGNATURE_MISMATCH",
        message: "License signature is invalid — file may be tampered",
      };
    }

    if (this.licenseData.expiryDate) {
      const expiry = new Date(this.licenseData.expiryDate);
      const now = new Date();
      if (expiry < now) {
        this.valid = false;
        return {
          valid: false,
          reason: "EXPIRED",
          message: `License expired on ${this.licenseData.expiryDate}`,
        };
      }
    }

    this.valid = true;
    return {
      valid: true,
      licenseKey: this.licenseData.licenseKey,
      clientName: this.licenseData.clientName,
      expiryDate: this.licenseData.expiryDate || null,
      features: this.licenseData.features || ["all"],
      issuedAt: this.licenseData.issuedAt,
    };
  }

  /**
   * Returns the current license status for the admin page, with the key masked.
   * Lazily loads the persisted file (if any) so an existing valid license is
   * reported as activated without requiring an explicit refresh call.
   *
   * @returns Activated state plus display fields (or a `reason`/`message`).
   */
  async getStatus(): Promise<LicenseStatus> {
    if (this.licenseData === null && (await this.fileExists())) {
      await this.loadFromFile();
    }
    if (this.valid && this.licenseData) {
      return {
        activated: true,
        licenseKey: maskLicenseKey(this.licenseData.licenseKey),
        clientName: this.licenseData.clientName,
        expiryDate: this.licenseData.expiryDate || null,
        features: this.licenseData.features || ["all"],
        reason: null,
        message: null,
      };
    }
    return {
      activated: false,
      licenseKey: null,
      clientName: null,
      expiryDate: null,
      features: null,
      reason: this.licenseData ? "VERIFICATION_FAILED" : "NOT_LOADED",
      message: "No valid license loaded",
    };
  }

  /**
   * Validates pasted `.lic` JSON content and, when valid, persists it to disk.
   *
   * @param licenseData - Raw JSON string of the license file.
   * @returns Activation result with persisted client/expiry/features on success.
   */
  async activate(licenseData: string): Promise<LicenseActivationResult> {
    const result = await this.loadFromData(licenseData);
    if (result.valid) {
      await this.saveToFile(licenseData);
      this._logSystemEvent("license_activated", {
        clientName: result.clientName ?? "",
        expiryDate: result.expiryDate ?? null,
        licenseKey: result.licenseKey ? maskLicenseKey(result.licenseKey) : null,
      });
      return {
        success: true,
        message: "License activated successfully",
        data: {
          clientName: result.clientName ?? "",
          expiryDate: result.expiryDate ?? null,
          features: result.features ?? ["all"],
        },
      };
    }
    this._logSystemEvent("license_activation_failed", {
      reason: result.reason || "ACTIVATION_FAILED",
    });
    return {
      success: false,
      reason: result.reason || "ACTIVATION_FAILED",
      message: result.message || "Failed to activate license",
    };
  }

  /**
   * Validates uploaded `.lic` file content and, when valid, persists it to disk.
   *
   * @param content - Raw text content of the uploaded license file.
   * @returns Activation result with persisted client/expiry on success.
   */
  async activateFile(content: string): Promise<LicenseActivationResult> {
    const result = await this.loadFromData(content);
    if (result.valid) {
      await this.saveToFile(content);
      this._logSystemEvent("license_activated", {
        source: "file",
        clientName: result.clientName ?? "",
        expiryDate: result.expiryDate ?? null,
        licenseKey: result.licenseKey ? maskLicenseKey(result.licenseKey) : null,
      });
      return {
        success: true,
        message: "License activated from file",
        data: {
          clientName: result.clientName ?? "",
          expiryDate: result.expiryDate ?? null,
          features: result.features ?? ["all"],
        },
      };
    }
    this._logSystemEvent("license_activation_failed", {
      source: "file",
      reason: result.reason || "ACTIVATION_FAILED",
    });
    return {
      success: false,
      reason: result.reason || "ACTIVATION_FAILED",
      message: result.message || "Invalid license file",
    };
  }

  /**
   * Removes the persisted license file and resets in-memory state.
   *
   * @returns `{ success: true }` always (deletion errors are swallowed).
   */
  async deactivate(): Promise<{ success: boolean }> {
    this.licenseData = null;
    this.valid = false;
    try {
      await unlink(LICENSE_PATH);
    } catch {
      // file may already be missing — that is fine
    }
    this._logSystemEvent("license_deactivated", {});
    return { success: true };
  }

  /**
   * Reloads the license from disk and reports whether it still validates.
   *
   * @returns Refresh result with the re-evaluated activation state.
   */
  async refresh(): Promise<LicenseRefreshResult> {
    let result: VerifyResult;
    if (await this.fileExists()) {
      result = await this.loadFromFile();
    } else {
      result = this.verify();
    }
    return {
      success: result.valid,
      data: {
        activated: result.valid,
        clientName: result.clientName || null,
        expiryDate: result.expiryDate || null,
        reason: result.reason || null,
      },
    };
  }

  /**
   * Loads the persisted license file from disk and verifies it.
   *
   * @returns Verification outcome, or a FILE_NOT_FOUND/read error result.
   */
  private async loadFromFile(): Promise<VerifyResult> {
    if (!(await this.fileExists())) {
      return {
        valid: false,
        reason: "FILE_NOT_FOUND",
        message: `License file not found: ${LICENSE_PATH}`,
      };
    }
    try {
      const raw = await readFile(LICENSE_PATH, "utf8");
      return this.loadFromData(raw);
    } catch (err) {
      return {
        valid: false,
        reason: "FILE_READ_ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Creates the licenses directory and writes the license content to disk. */
  private async saveToFile(content: string): Promise<string> {
    await mkdir(LICENSE_DIR, { recursive: true });
    await writeFile(LICENSE_PATH, content, "utf8");
    return LICENSE_PATH;
  }

  /** Whether the persisted license file currently exists on disk. */
  private async fileExists(): Promise<boolean> {
    try {
      await access(LICENSE_PATH);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * يسجّل حدث نظام في سجل الأنشطة بأمان: أي فشل في التسجيل يُطبَع فقط ولا
   * يعطّل عملية الترخيص الأصلية.
   *
   * @param action - إجراء النظام (`license_activated` | `license_activation_failed` | `license_deactivated`).
   * @param details - تفاصيل العملية (اسم العميل وتاريخ الانتهاء ومفتاح مقنّع أو سبب الفشل).
   */
  private _logSystemEvent(action: string, details: Record<string, unknown>): void {
    if (!this.activityRepo) return;
    void this.activityRepo
      .logActivity({
        entityType: "system",
        action,
        module: "license",
        severity: action === "license_activation_failed" ? "error" : "info",
        details,
      })
      .catch((err: Error) => {
        console.error(`[LicenseService] Failed to log ${action}:`, err.message);
      });
  }
}
