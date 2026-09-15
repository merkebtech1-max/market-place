import type { AuthResponse } from "@/features/auth/types";
import { logout, refreshTokens } from "@/features/auth/actions";
import { apiRequest, ApiError } from "./api";

const AUTH_STORAGE_KEY = "merkeb-auth";
const AUTH_CHANGED_EVENT = "merkeb-auth-changed";

export interface StoredAuthSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

export function saveAuthSession(response: AuthResponse) {
  window.sessionStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ userId: response.userId, ...response.tokens })
  );
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthSession() {
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getAuthSession(): StoredAuthSession | null {
  try {
    const value = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    return value ? (JSON.parse(value) as StoredAuthSession) : null;
  } catch {
    return null;
  }
}

export function getServerAuthSession(): null {
  return null;
}

export function getIsAuthenticated() {
  return Boolean(window.sessionStorage.getItem(AUTH_STORAGE_KEY));
}

export function getServerIsAuthenticated() {
  return false;
}

export function subscribeAuthSession(onChange: () => void) {
  window.addEventListener(AUTH_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Calls a protected endpoint and rotates tokens once when access has expired. */
export async function authenticatedApiRequest<T>(path: string, init?: RequestInit) {
  const session = getAuthSession();
  if (!session) throw new ApiError("Please sign in to continue.", 401);

  const call = (accessToken: string) =>
    apiRequest<T>(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
    });

  try {
    return await call(session.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const refreshed = await refreshTokens(session.refreshToken);
    saveAuthSession(refreshed);
    return call(refreshed.tokens.accessToken);
  }
}

export async function logoutCurrentSession() {
  const session = getAuthSession();
  try {
    if (session) await logout(session.accessToken);
  } finally {
    clearAuthSession();
  }
}
