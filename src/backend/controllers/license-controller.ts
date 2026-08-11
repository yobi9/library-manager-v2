import { BaseController, type ControllerResult } from "./base-controller";
import type { LicenseService } from "../services/license-service";

/**
 * HTTP boundary for the license feature. Delegates to {@link LicenseService}
 * and maps verification failures to 400 responses with the exact reason code
 * (matching the old project's `/api/license/*` contract).
 */
export class LicenseController extends BaseController {
  constructor(private licenseService: LicenseService) {
    super();
  }

  /**
   * Returns the current license status for the admin license page.
   *
   * @returns `ok(status)` with the license state and masked key.
   */
  async getStatus(): Promise<ControllerResult> {
    try {
      const status = await this.licenseService.getStatus();
      return this.ok(status);
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * Activates a license from pasted JSON content.
   *
   * @param body - Parsed request body (`{ licenseData: string }`).
   * @returns `ok` with persisted data on success, or 400 with the reason code.
   */
  async activate(body: Record<string, unknown>): Promise<ControllerResult> {
    const licenseData = body["licenseData"];
    if (typeof licenseData !== "string" || !licenseData.trim()) {
      return this.error(
        "licenseData is required — paste the .lic file content as JSON string",
        400,
      );
    }
    const result = await this.licenseService.activate(licenseData);
    if (result.success) {
      return this.ok(result.data, result.message);
    }
    return {
      success: false,
      status: 400,
      error: result.reason ?? "ACTIVATION_FAILED",
      message: result.message ?? "Failed to activate license",
    };
  }

  /**
   * Activates a license from an uploaded `.lic` file's text content.
   *
   * @param content - Raw text content of the uploaded file.
   * @returns `ok` with persisted data on success, or 400 with the reason code.
   */
  async activateFile(content: string): Promise<ControllerResult> {
    const result = await this.licenseService.activateFile(content);
    if (result.success) {
      return this.ok(result.data, result.message);
    }
    return {
      success: false,
      status: 400,
      error: result.reason ?? "ACTIVATION_FAILED",
      message: result.message ?? "Invalid license file",
    };
  }

  /**
   * Removes the persisted license and clears in-memory state.
   *
   * @returns `ok({ success: true })`.
   */
  async deactivate(): Promise<ControllerResult> {
    try {
      const result = await this.licenseService.deactivate();
      return this.ok(result, "License deactivated");
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * Reloads the license from disk and reports whether it still validates.
   *
   * @returns `ok(refreshResult)` with the re-evaluated state.
   */
  async refresh(): Promise<ControllerResult> {
    try {
      const result = await this.licenseService.refresh();
      return this.ok(result.data, result.success ? undefined : "License still invalid");
    } catch (err) {
      return this.handleError(err);
    }
  }
}
