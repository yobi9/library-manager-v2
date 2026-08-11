"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

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
        const res = await fetch("/api/auth", { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as { success: boolean; data?: User };
          if (data.success && data.data) {
            setUser(data.data);
          }
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
      const res = await fetch("/api/auth");
      if (res.ok) {
        const data = (await res.json()) as { success: boolean; data?: User };
        if (data.success && data.data) {
          setUser(data.data);
        }
      }
    } catch {
      setUser(null);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      let errorMessage: string;
      try {
        const data = (await res.json()) as { error?: string };
        errorMessage = data.error ?? res.statusText;
      } catch {
        errorMessage = res.statusText || "فشل تسجيل الدخول";
      }
      throw new Error(errorMessage);
    }

    await refreshAuth();
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" });
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
