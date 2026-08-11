/**
 * Represents a failed attempt to start a scan while another scan operation
 * is already active (or the same library is already being scanned).
 *
 * Purpose: the scanner enforces a single active top-level scan; callers
 * (e.g. `ScanController`) map this error to HTTP 409 Conflict so the
 * frontend sees a real "already running" message instead of a false 202.
 *
 * Source of truth: thrown by `ScanOrchestrator.prepareScan` /
 * `prepareContainer` / `prepareScanAll` (src/backend/scanner/scan-orchestrator.ts).
 *
 * Scope: guard-only error — it carries no payload beyond the message.
 *
 * Limitations: the message is intentionally human-readable Arabic/English
 * mix used directly in API responses; it is not localized per locale.
 */
export class ScanAlreadyRunningError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "يوجد مسح قيد التنفيذ — انتظر انتهاءه قبل بدء مسح آخر (A scan is already running)",
    );
    this.name = "ScanAlreadyRunningError";
  }
}
