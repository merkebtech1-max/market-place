"use client";

import { useCallback, useSyncExternalStore } from "react";

export const SESSION_STORAGE_KEY = "merkeb.session";

export type SessionUser = {
  name: string;
  phone?: string;
};

type SessionListener = () => void;

const listeners = new Set<SessionListener>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: SessionListener) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SESSION_STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

let cachedRaw: string | null = null;
let cachedSession: SessionUser | null = null;

// useSyncExternalStore requires getSnapshot to return a stable reference
// when the underlying value hasn't changed, so we cache by the raw string.
export function readSession(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === cachedRaw) return cachedSession;
    cachedRaw = raw;
    if (!raw) return (cachedSession = null);
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed?.name || typeof parsed.name !== "string") return (cachedSession = null);
    return (cachedSession = { name: parsed.name.trim(), phone: parsed.phone });
  } catch {
    return (cachedSession = null);
  }
}

export function saveSession(user: SessionUser) {
  const payload: SessionUser = {
    name: user.name.trim(),
    ...(user.phone ? { phone: user.phone } : {}),
  };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  emit();
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  emit();
}

function getServerSnapshot(): SessionUser | null {
  return null;
}

/** Client session until real auth (SRS §8.1) is wired. */
export function useSession() {
  const user = useSyncExternalStore(subscribe, readSession, getServerSnapshot);
  const signIn = useCallback((next: SessionUser) => saveSession(next), []);
  const signOut = useCallback(() => clearSession(), []);
  return { user, isAuthenticated: Boolean(user), signIn, signOut };
}

export function firstLetterOf(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const first = Array.from(trimmed)[0] ?? "?";
  return first.toLocaleUpperCase();
}
