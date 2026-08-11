"use client";

import { useState, useCallback } from "react";
import {
  getWatchLaterIds,
  addWatchLaterId,
  removeWatchLaterId,
} from "./watch-later-storage";

export function useWatchLater() {
  const [ids, setIds] = useState<number[]>(() => getWatchLaterIds());

  const isWatchLater = useCallback(
    (id: number) => ids.includes(id),
    [ids],
  );

  const toggle = useCallback((id: number, current: boolean) => {
    if (current) removeWatchLaterId(id);
    else addWatchLaterId(id);
    setIds(getWatchLaterIds());
  }, []);

  return { ids, isWatchLater, toggle };
}
