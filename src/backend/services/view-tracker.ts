const MAX_EMITTED_VIEWS = 50000;
const VIEW_COOLDOWN = 600000;
const CLEANUP_INTERVAL = 300000;

export class ViewTrackerService {
  private _emittedViews = new Map<string, number>();
  private _interval: ReturnType<typeof setInterval>;

  constructor() {
    this._interval = setInterval(() => this._cleanup(), CLEANUP_INTERVAL);
    this._interval.unref();
  }

  canEmit(viewerKey: string): boolean {
    if (!viewerKey) return false;
    const last = this._emittedViews.get(viewerKey);
    const now = Date.now();
    if (last && now - last < VIEW_COOLDOWN) return false;
    if (this._emittedViews.size >= MAX_EMITTED_VIEWS) {
      const oldestKey = this._emittedViews.keys().next().value;
      if (oldestKey) this._emittedViews.delete(oldestKey);
    }
    this._emittedViews.set(viewerKey, now);
    return true;
  }

  private _cleanup(): void {
    const now = Date.now();
    for (const [key, ts] of this._emittedViews.entries()) {
      if (now - ts > VIEW_COOLDOWN * 2) {
        this._emittedViews.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this._interval);
    this._emittedViews.clear();
  }
}
