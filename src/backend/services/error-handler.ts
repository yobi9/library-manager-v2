interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
  type: "Validation" | "Database" | "Scanner" | "GeneralError";
  context?: Record<string, unknown>;
}

export class ErrorHandler {
  private errorLogs: ErrorInfo[] = [];
  private maxLogs = 100;

  async logError(error: Error, context: Record<string, unknown> = {}): Promise<ErrorInfo> {
    const errorInfo = this.classifyError(error);
    errorInfo.context = context;

    this._updateLocalLogs(errorInfo);

    setImmediate(() => {
      this._performHeavyLogging(error, errorInfo);
    });

    return errorInfo;
  }

  classifyError(error: Error & { code?: string }): ErrorInfo {
    const info: ErrorInfo = {
      message: error.message || "Unknown Error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      severity: "medium",
      type: "GeneralError",
    };

    if (error.name === "ValidationError") {
      info.type = "Validation";
      info.severity = "low";
    } else if (error.name === "DatabaseError" || error.code?.includes("SQLITE")) {
      info.type = "Database";
      info.severity = "high";
    } else if (error.name === "ScannerError") {
      info.type = "Scanner";
      info.severity = "medium";
    }

    return info;
  }

  getStatusCode(error: Error & { status?: number; name?: string }): number {
    if (error.status) return error.status;
    if (error.name === "ValidationError") return 400;
    if (error.name === "UnauthorizedError") return 401;
    return 500;
  }

  getRecentLogs(count?: number): ErrorInfo[] {
    return this.errorLogs.slice(0, count ?? 10);
  }

  private _updateLocalLogs(info: ErrorInfo): void {
    this.errorLogs.unshift(info);
    if (this.errorLogs.length > this.maxLogs) this.errorLogs.pop();
  }

  private _performHeavyLogging(error: Error, info: ErrorInfo): void {
    if (info.severity === "high") {
      console.error(`[CRITICAL ERROR]: ${info.message}`);
    }
  }
}

let _errorHandlerInstance: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
  if (!_errorHandlerInstance) {
    _errorHandlerInstance = new ErrorHandler();
  }
  return _errorHandlerInstance;
}
