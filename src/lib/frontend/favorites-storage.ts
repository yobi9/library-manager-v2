const STORAGE_KEY = "favorites_ids";

export function getLocalFavorites(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalFavorites(ids: number[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function addLocalFavorite(id: number): void {
  const ids = getLocalFavorites();
  if (!ids.includes(id)) {
    setLocalFavorites([...ids, id]);
  }
}

export function removeLocalFavorite(id: number): void {
  setLocalFavorites(getLocalFavorites().filter((i) => i !== id));
}

export function clearLocalFavorites(): void {
  localStorage.removeItem(STORAGE_KEY);
}
