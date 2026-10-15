import { create } from 'zustand';

/**
 * Access token lives only in memory (never localStorage) to reduce XSS blast radius.
 * The refresh token lives in an httpOnly cookie set by the backend and is invisible to JS.
 * On app load, `bootstrapAuth()` calls /auth/refresh to silently obtain a fresh access token
 * if a valid refresh cookie exists.
 */
export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  isAuthReady: false,

  setSession: (user, accessToken) => set({ user, accessToken, isAuthReady: true }),

  setAccessToken: (accessToken) => set({ accessToken }),

  clearSession: () => set({ user: null, accessToken: null, isAuthReady: true }),

  markAuthReady: () => set({ isAuthReady: true }),
}));
