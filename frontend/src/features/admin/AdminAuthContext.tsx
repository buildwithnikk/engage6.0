"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAdminMe, adminLogin, adminLogout } from "@/lib/api-client";
import type { AdminUserSummary, LoginRequest } from "@/types/api";
import { ApiError } from "@/types/api";

type AdminAuthContextType = {
  user: AdminUserSummary | null;
  csrfToken: string | null;
  isLoading: boolean;
  error: string | null;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUserSummary | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAdminMe();
      setUser(res.user);
      setCsrfToken(res.csrf_token);
    } catch (err) {
      setUser(null);
      setCsrfToken(null);
      if (err instanceof ApiError && err.status === 401) {
        // Not logged in or expired session is normal, not an error banner
      } else if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (payload: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminLogin(payload);
      setUser(res.user);
      setCsrfToken(res.csrf_token);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected login error occurred.");
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await adminLogout(csrfToken || undefined);
    } catch {
      // Continue client cleanup even if network request fails
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        csrfToken,
        isLoading,
        error,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
