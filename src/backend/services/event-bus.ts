import { EventEmitter } from "events";

const MAX_LISTENERS_WARN = 30;

interface Bridge {
  source: EventEmitter;
  events: string[];
  handlers: Map<string, (...args: unknown[]) => void>;
}

export class EventBus {
  private _emitter = new EventEmitter();
  private _bridges: Bridge[] = [];
  private _handlerCount = 0;

  constructor() {
    this._emitter.setMaxListeners(MAX_LISTENERS_WARN);
  }

  on(event: string, handler: (...args: unknown[]) => void): () => void {
    this._emitter.on(event, handler);
    this._handlerCount++;
    if (this._emitter.listenerCount(event) > MAX_LISTENERS_WARN) {
      console.warn(
        `[EventBus] Possible leak: "${event}" has ${this._emitter.listenerCount(event)} listeners (max: ${MAX_LISTENERS_WARN})`,
      );
    }
    return () => this._removeHandler(event, handler);
  }

  emit(event: string, data?: unknown): void {
    this._emitter.emit(event, data);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this._emitter.off(event, handler);
    this._handlerCount--;
  }

  private _removeHandler(
    event: string,
    handler: (...args: unknown[]) => void,
  ): void {
    if (this._emitter.listeners(event).includes(handler)) {
      this._emitter.off(event, handler);
      this._handlerCount--;
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      const handlers = this._emitter.listeners(event);
      this._emitter.removeAllListeners(event);
      this._handlerCount -= handlers.length;
    } else {
      this._emitter.removeAllListeners();
      this._handlerCount = 0;
    }
  }

  listenerCount(event: string): number {
    return this._emitter.listenerCount(event);
  }

  bridge(source: EventEmitter, events: string[]): this {
    if (!source || typeof source.on !== "function") {
      console.warn("[EventBus] bridge: source is not an EventEmitter");
      return this;
    }

    const handlers = new Map<string, (...args: unknown[]) => void>();

    for (const event of events) {
      const handler = (data?: unknown) => {
        this.emit(event, data);
      };
      source.on(event, handler);
      handlers.set(event, handler);
    }

    this._bridges.push({ source, events: [...events], handlers });
    return this;
  }

  unbridgeAll(): void {
    for (const { source, handlers } of this._bridges) {
      if (source && typeof source.off === "function") {
        for (const [event, handler] of handlers) {
          source.off(event, handler);
        }
      }
    }
    this._bridges = [];
  }

  getHandlerCount(): number {
    return this._handlerCount;
  }
}

let _eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!_eventBusInstance) {
    _eventBusInstance = new EventBus();
  }
  return _eventBusInstance;
}
