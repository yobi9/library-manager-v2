"use client";

import { useEffect, useState } from "react";

/** Kind of background session tracked by the realtime hook. */
export type AdminRealtimeSessionKind = "enrichment" | "translation";

/** Live progress of a background enrichment/translation session. */
export interface AdminRealtimeSession {
  sessionId: string;
  kind: AdminRealtimeSessionKind;
  processed: number;
  total: number;
  percentage: number;
  successful: number;
  failed: number;
  currentId: number | null;
  status: "active" | "completed" | "failed" | "cancelled";
}

/** Aggregated realtime state consumed by admin pages. */
export interface AdminRealtimeState {
  connected: boolean;
  error: string | null;
  /** يزداد عند كل حدث يغيّر بيانات الوسائط (media:changed / completed) — لتحديث القوائم. */
  mediaVersion: number;
  enrichmentSession: AdminRealtimeSession | null;
  translationSession: AdminRealtimeSession | null;
}

const INITIAL_STATE: AdminRealtimeState = {
  connected: false,
  error: null,
  mediaVersion: 0,
  enrichmentSession: null,
  translationSession: null,
};

/**
 * React hook streaming admin background-job events via SSE (/api/admin/events).
 *
 * Provides live enrichment/translation session progress and a `mediaVersion`
 * counter that increments whenever media data changes on the server, so pages
 * can invalidate their queries automatically (no manual polling).
 *
 * @returns Object with connection status, per-kind session progress, and
 *          `mediaVersion` which consumers should watch to refetch lists.
 */
export function useAdminRealtimeEvents(): AdminRealtimeState {
  const [state, setState] = useState<AdminRealtimeState>(INITIAL_STATE);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    const es = new EventSource("/api/admin/events");

    es.addEventListener("connected", () => {
      setState((prev) => ({ ...prev, connected: true, error: null }));
    });

    es.addEventListener("enrichment_progress", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        const sessionId = String(data.sessionId ?? "enrich");
        const status: AdminRealtimeSession["status"] =
          data.type === "completed"
            ? "completed"
            : data.type === "failed"
              ? "failed"
              : "active";
        const bump = status === "completed" || status === "failed";
        setState((prev) => ({
          ...prev,
          ...(bump ? { mediaVersion: prev.mediaVersion + 1 } : {}),
          enrichmentSession: {
            sessionId,
            kind: "enrichment",
            processed: Number(data.processed ?? 0),
            total: Number(data.total ?? 0),
            percentage: Number(data.percentage ?? 0),
            successful: Number(data.successful ?? 0),
            failed: Number(data.failed ?? 0),
            currentId: data.currentId != null ? Number(data.currentId) : null,
            status,
          },
        }));
      } catch {
        // ignore malformed payload
      }
    });

    es.addEventListener("metadata_completed", () => {
      setState((prev) => ({ ...prev, mediaVersion: prev.mediaVersion + 1 }));
    });

    es.addEventListener("media:changed", () => {
      setState((prev) => ({ ...prev, mediaVersion: prev.mediaVersion + 1 }));
    });

    es.addEventListener("media_updated", () => {
      setState((prev) => ({ ...prev, mediaVersion: prev.mediaVersion + 1 }));
    });

    es.addEventListener("translation_progress", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        const sessionId = String(data.sessionId ?? "translate");
        const status: AdminRealtimeSession["status"] =
          data.type === "completed"
            ? "completed"
            : data.type === "cancelled"
              ? "cancelled"
              : "active";
        const bump = status === "completed" || status === "cancelled";
        setState((prev) => ({
          ...prev,
          ...(bump ? { mediaVersion: prev.mediaVersion + 1 } : {}),
          translationSession: {
            sessionId,
            kind: "translation",
            processed: Number(data.processed ?? 0),
            total: Number(data.total ?? 0),
            percentage: Number(data.percentage ?? 0),
            successful: Number(data.successful ?? 0),
            failed: Number(data.failed ?? 0),
            currentId: data.currentId != null ? Number(data.currentId) : null,
            status,
          },
        }));
      } catch {
        // ignore malformed payload
      }
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setState((prev) => ({ ...prev, connected: false, error: "انقطع الاتصال اللحظي" }));
      }
    };

    return () => {
      es.close();
    };
  }, []);

  return state;
}
