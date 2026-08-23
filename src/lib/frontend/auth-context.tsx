"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { apiFetch, apiPost, apiDelete } from "@/lib/frontend/api-client";

interface User {
  id: string;
  username: string;
  role: "admin" | "viewer";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const data = await apiFetch<User>("/api/auth", { signal: controller.signal });
        if (data.success && data.data) {
          setUser(data.data);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const data = await apiFetch<User>("/api/auth");
      if (data.success && data.data) {
        setUser(data.data);
      }
    } catch {
      setUser(null);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await apiPost<unknown>("/api/auth", { username, password });
    await refreshAuth();
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    try {
      await apiDelete("/api/auth");
    } catch {
      // حتى لو فشل الخادم (مثلاً جلسة منتهية أصلاً)، تُصفَّر الحالة محلياً دائماً.
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
