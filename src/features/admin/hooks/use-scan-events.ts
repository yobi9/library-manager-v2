"use client";

import { useState, useEffect, useRef } from "react";
import type { ScanProgress } from "@/features/admin/hooks/use-admin-libraries";

interface ScanEventsState {
  data: ScanProgress | undefined;
  isLoading: boolean;
  error: string | null;
}

/**
 * React hook that connects to the SSE endpoint for real-time scan progress.
 * Opens an EventSource connection to /api/scan-events and receives push updates
 * whenever a scan event occurs on the server.
 *
 * @param libraryId - Library ID to track, or null for all libraries
 *   (when null, the hook connects but the SSE endpoint returns generic status).
 * @param options - { enabled } — disables connection when false.
 * @returns Object with:
 *   - data: ScanProgress | null — current scan state from server push
 *   - isLoading: boolean — true until the first "progress" or "connected" event
 *   - error: string | null — connection error message if any
 *
 * Side effects:
 *   - Opens an EventSource connection on mount (when enabled)
 *   - Closes the connection on unmount or when disabled/libraryId changes
 *   - Does NOT reconnect on 401/403 or non-transient errors
 *
 * Notes:
 *   - Same ScanProgress interface, so consuming components need no changes
 *   - Falls back silently if the browser doesn't support EventSource
 */
export function useScanEvents(
  libraryId: number | null,
  options?: { enabled?: boolean },
): ScanEventsState {
  const [state, setState] = useState<ScanEventsState>({
    data: undefined,
    isLoading: true,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const enabled = options?.enabled !== false;

    if (!enabled || typeof EventSource === "undefined") {
      return;
    }

    const params = libraryId ? `?libraryId=${libraryId}` : "";
    const url = `/api/scan-events${params}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      setState({ data: undefined, isLoading: false, error: null });
    });

    es.addEventListener("progress", (event: MessageEvent) => {
      try {
        const progress = JSON.parse(event.data) as ScanProgress;
        setState({ data: progress, isLoading: false, error: null });
      } catch {
        setState((prev) => ({ ...prev, error: "فشل تحليل بيانات التقدم" }));
      }
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setState((prev) => ({ ...prev, isLoading: false, error: "انقطع الاتصال" }));
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [libraryId, options?.enabled]);

  return state;
}
