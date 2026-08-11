interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: string[];
}

interface RetryStats {
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  totalDelay: number;
  successRate: string;
  averageDelay: number;
}

interface CircuitState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  lastFailureTime: number;
  failureThreshold: number;
  resetTimeout: number;
}

export class RetryManager {
  private config: RetryConfig;
  private stats: Omit<RetryStats, "successRate" | "averageDelay">;
  private circuits: Map<string, CircuitState>;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialDelay: config.initialDelay ?? 1000,
      maxDelay: config.maxDelay ?? 30000,
      backoffFactor: config.backoffFactor ?? 2,
      retryableErrors: config.retryableErrors ?? [
        "NETWORK_ERROR",
        "TIMEOUT_ERROR",
        "DATABASE_CONNECTION_ERROR",
        "SQLITE_BUSY",
        "SQLITE_LOCKED",
      ],
    };

    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      totalDelay: 0,
    };

    this.circuits = new Map();
  }

  calculateDelay(attempt: number): number {
    const delay = this.config.initialDelay * Math.pow(this.config.backoffFactor, attempt - 1);
    return Math.min(delay, this.config.maxDelay);
  }

  isRetryableError(error: Error & { code?: string; errno?: number; retryable?: boolean }): boolean {
    if (error.retryable === true) return true;
    if (error.retryable === false) return false;

    const code = error.code || "";

    return (
      this.config.retryableErrors.includes(code) ||
      code === "ETIMEDOUT" ||
      code === "ECONNRESET" ||
      code === "ECONNREFUSED" ||
      error.message?.includes("SQLITE_BUSY") ||
      error.message?.includes("SQLITE_LOCKED") ||
      error.message?.includes("database is locked") ||
      error.errno === 5 ||
      error.errno === 6
    );
  }

  async executeWithRetry<T>(operation: () => Promise<T>, _context?: Record<string, unknown>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      this.stats.totalAttempts++;

      try {
        const result = await operation();

        if (attempt > 1) {
          this.stats.successfulRetries++;
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryableError(lastError) || attempt === this.config.maxRetries) {
          this.stats.failedRetries++;
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        this.stats.totalDelay += delay;

        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error("RetryManager: unknown error");
  }

  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitId: string,
    options: { failureThreshold?: number; resetTimeout?: number } = {},
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(circuitId, options);
    const now = Date.now();

    if (circuit.state === "OPEN") {
      if (now - circuit.lastFailureTime > circuit.resetTimeout) {
        circuit.state = "HALF_OPEN";
      } else {
        throw new Error(`Circuit ${circuitId} is OPEN. Try again later.`);
      }
    }

    try {
      const result = await this.executeWithRetry(operation);

      circuit.failureCount = 0;
      if (circuit.state === "HALF_OPEN") {
        circuit.state = "CLOSED";
      }

      return result;
    } catch (error) {
      circuit.failureCount++;
      circuit.lastFailureTime = now;

      if (circuit.failureCount >= circuit.failureThreshold) {
        circuit.state = "OPEN";
      }

      throw error;
    }
  }

  private getOrCreateCircuit(
    circuitId: string,
    options: { failureThreshold?: number; resetTimeout?: number } = {},
  ): CircuitState {
    if (!this.circuits.has(circuitId)) {
      this.circuits.set(circuitId, {
        state: "CLOSED",
        failureCount: 0,
        lastFailureTime: 0,
        failureThreshold: options.failureThreshold ?? 5,
        resetTimeout: options.resetTimeout ?? 60000,
      });
    }

    return this.circuits.get(circuitId)!;
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats(): RetryStats {
    return {
      ...this.stats,
      successRate:
        this.stats.totalAttempts > 0
          ? (
              ((this.stats.totalAttempts - this.stats.failedRetries) /
                this.stats.totalAttempts) *
              100
            ).toFixed(2)
          : "0",
      averageDelay:
        this.stats.totalAttempts > 0
          ? Math.round(this.stats.totalDelay / this.stats.totalAttempts)
          : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      totalDelay: 0,
    };
  }
}

let _retryInstance: RetryManager | null = null;

export function getRetryManager(): RetryManager {
  if (!_retryInstance) {
    _retryInstance = new RetryManager();
  }
  return _retryInstance;
}
