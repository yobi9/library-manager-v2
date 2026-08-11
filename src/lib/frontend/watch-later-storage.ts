const STORAGE_KEY = "watch_later_ids";

export function getWatchLaterIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setWatchLaterIds(ids: number[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function addWatchLaterId(id: number): void {
  const ids = getWatchLaterIds();
  if (!ids.includes(id)) {
    setWatchLaterIds([...ids, id]);
  }
}

export function removeWatchLaterId(id: number): void {
  setWatchLaterIds(getWatchLaterIds().filter((i) => i !== id));
}

export function clearWatchLaterIds(): void {
  localStorage.removeItem(STORAGE_KEY);
}
