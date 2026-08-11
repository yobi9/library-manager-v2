"use client";

import { useCallback, useMemo, useRef } from "react";

/**
 * Client-side watch progress snapshot for a single media item, persisted in
 * the browser's localStorage. Nothing is ever sent to the server.
 */
export interface WatchProgress {
  /** Current playback position in seconds. */
  time: number;
  /** Total media duration in seconds. */
  duration: number;
  /** Unix timestamp (ms) of the last save. */
  updatedAt: number;
}

/** Prefix scoping progress keys per media item. */
const STORAGE_PREFIX = "lm2:watch-progress:";

/** Minimum interval between throttled saves (ms). */
const SAVE_THROTTLE_MS = 5000;

/**
 * Reads the saved progress for a media id, tolerating corrupt/missing entries.
 *
 * @param id - Media id used as the storage key scope.
 * @returns The stored snapshot, or null when absent or invalid.
 */
function readProgress(id: string): WatchProgress | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WatchProgress>;
    if (typeof parsed.time !== "number" || !Number.isFinite(parsed.time)) return null;
    return {
      time: parsed.time,
      duration: typeof parsed.duration === "number" ? parsed.duration : 0,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Manages per-item watch progress entirely inside the client's localStorage so
 * the resume position stays on the device and never touches the server.
 *
 * @param id - Media id scoping the storage key.
 * @returns The saved resume time in seconds (0 when none), a throttled saver,
 *          an immediate flusher, and a clearer for the ended state.
 */
export function useWatchProgress(id: string): {
  resumeTime: number;
  savePosition: (time: number, duration: number) => void;
  flushPosition: (time: number, duration: number) => void;
  clearPosition: () => void;
} {
  const lastSaveRef = useRef(0);

  const resumeTime = useMemo(() => {
    if (typeof window === "undefined") return 0;
    return readProgress(id)?.time ?? 0;
  }, [id]);

  const savePosition = useCallback(
    (time: number, duration: number) => {
      const now = Date.now();
      if (now - lastSaveRef.current < SAVE_THROTTLE_MS) return;
      lastSaveRef.current = now;
      try {
        window.localStorage.setItem(
          STORAGE_PREFIX + id,
          JSON.stringify({ time, duration, updatedAt: now } satisfies WatchProgress),
        );
      } catch {
        // Storage full/unavailable — resume silently degrades.
      }
    },
    [id],
  );

  const flushPosition = useCallback(
    (time: number, duration: number) => {
      lastSaveRef.current = Date.now();
      try {
        window.localStorage.setItem(
          STORAGE_PREFIX + id,
          JSON.stringify({
            time,
            duration,
            updatedAt: lastSaveRef.current,
          } satisfies WatchProgress),
        );
      } catch {
        // Storage full/unavailable — resume silently degrades.
      }
    },
    [id],
  );

  const clearPosition = useCallback(() => {
    lastSaveRef.current = 0;
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + id);
    } catch {
      // Storage unavailable — nothing to clear.
    }
  }, [id]);

  return { resumeTime, savePosition, flushPosition, clearPosition };
}
