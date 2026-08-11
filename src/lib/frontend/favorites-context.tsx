"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  getLocalFavorites,
  addLocalFavorite,
  removeLocalFavorite,
} from "./favorites-storage";

interface FavoritesContextType {
  favorites: number[];
  isFavorite: (mediaId: number) => boolean;
  toggleFavorite: (mediaId: number, current: boolean) => void;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(
  undefined,
);

export function FavoritesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [favorites, setFavorites] = useState<number[]>(() => getLocalFavorites());
  const [loading, setLoading] = useState(false);

  const isFavorite = useCallback(
    (id: number) => favorites.includes(id),
    [favorites],
  );

  const toggleFavorite = useCallback((mediaId: number, current: boolean) => {
    if (current) {
      removeLocalFavorite(mediaId);
      setFavorites((prev) => prev.filter((id) => id !== mediaId));
    } else {
      addLocalFavorite(mediaId);
      setFavorites((prev) => [...prev, mediaId]);
    }
  }, []);

  const value = useMemo(
    () => ({ favorites, isFavorite, toggleFavorite, loading }),
    [favorites, isFavorite, toggleFavorite, loading],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavoritesContext() {
  const context = useContext(FavoritesContext);
  if (!context)
    throw new Error(
      "useFavoritesContext must be used within FavoritesProvider",
    );
  return context;
}
