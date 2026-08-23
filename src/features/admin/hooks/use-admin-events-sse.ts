"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Event row normalized client-side from an SSE payload (never persisted).
 */
export interface AdminEvent {
  event_id: number;
  action: string;
  details?: string;
  user_name?: string;
  ip_address?: string;
  created_at: string;
  [key: string]: unknown;
}

/**
 * SSE event names emitted by `/api/admin/events`.
 * These match the named events subscribed on the backend EventBus.
 */
const SSE_EVENTS = [
  "enrichment_progress",
  "metadata_started",
  "metadata_completed",
  "media:changed",
  "media_updated",
  "media_deleted",
  "translation_progress",
  "system_alert",
  "user_view",
  "visitor_view",
  "scan_started",
  "scan_completed",
  "scan_failed",
  "scan_paused",
  "scan_resumed",
  "scan_stopped",
  "scan_error",
] as const;

type SseEventName = (typeof SSE_EVENTS)[number];

interface EventsSSEState {
  data: AdminEvent[] | undefined;
  error: string | null;
  connected: boolean;
}

/** Total count of events the hook buffers internally since (re)connection. */
let internalCounter = 0;

/**
 * Normalizes a raw SSE payload into the `AdminEvent` shape consumed by the
 * admin events page, so live events can be rendered alongside the persisted
 * history without a second schema.
 *
 * @param eventName - Named SSE event (e.g. "user_view").
 * @param payload - Raw JSON payload delivered by the event stream.
 * @returns A normalized AdminEvent row (client-side only).
 */
function normalizeEvent(eventName: SseEventName, payload: unknown): AdminEvent {
  const record =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};

  const summary =
    typeof record.message === "string"
      ? record.message
      : typeof record.error === "string"
        ? record.error
        : typeof record.itemTitle === "string"
          ? record.itemTitle
          : typeof record.title === "string"
            ? record.title
            : typeof record.type === "string"
              ? String(record.type)
              : "";

  return {
    event_id: Date.now() * 1000 + ++internalCounter,
    action: eventName,
    details: summary,
    user_name: typeof record.username === "string" ? record.username : undefined,
    ip_address: undefined,
    created_at: new Date().toISOString(),
    ...record,
  };
}

/**
 * Real-time subscription to the admin SSE event stream.
 *
 * Subscribes to every named event emitted by `/api/admin/events`, normalizes
 * incoming payloads to `AdminEvent`, and prepends them to the local buffer.
 * The `data` change is used by the events page to trigger an immediate
 * refetch of the persisted history so live rows always match the database.
 */
export function useAdminEventsSSE(options?: { enabled?: boolean }) {
  const [state, setState] = useState<EventsSSEState>({
    data: undefined,
    error: null,
    connected: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  /** Whether an SSE stream is expected (enabled and EventSource available). */
  const canStream = options?.enabled !== false && typeof EventSource !== "undefined";

  /** Clears the local live-event buffer. */
  const clear = useCallback(() => {
    setState((prev) => ({ ...prev, data: undefined }));
  }, []);

  useEffect(() => {
    const enabled = options?.enabled !== false;

    if (!enabled || typeof EventSource === "undefined") {
      return;
    }

    const es = new EventSource("/api/admin/events");
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      setState((prev) => ({
        ...prev,
        connected: true,
        error: null,
      }));
    });

    for (const eventName of SSE_EVENTS) {
      es.addEventListener(eventName, (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as unknown;
          const newEvent = normalizeEvent(eventName, payload);
          setState((prev) => ({
            ...prev,
            data: prev.data ? [newEvent, ...prev.data] : [newEvent],
          }));
        } catch {
          setState((prev) => ({ ...prev, error: "فشل تحليل بيانات الحدث" }));
        }
      });
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setState((prev) => ({
          ...prev,
          connected: false,
          error: "انقطع الاتصال بالخادم",
        }));
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [options?.enabled]);

  return {
    ...state,
    clear,
    isLoading: canStream && !state.connected,
  };
}
