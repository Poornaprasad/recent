"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/lib/domain/types";

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  setUser: (user: User | null) => void;
  setTokens: (token: string, refreshToken?: string, tokenExpiry?: number) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      tokenExpiry: null,
      setUser: (user) => set({ user }),
      setTokens: (token, refreshToken, tokenExpiry) =>
        set({
          token,
          refreshToken: refreshToken || null,
          tokenExpiry: tokenExpiry || null,
        }),
      clearAuth: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          tokenExpiry: null,
        }),
      isAuthenticated: () => {
        const state = get();
        if (!state.user || !state.token) return false;
        if (state.tokenExpiry && Date.now() > state.tokenExpiry) return false;
        return true;
      },
    }),
    {
      name: "auth-storage",
    }
  )
);
