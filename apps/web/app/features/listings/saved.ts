"use client";

import { useCallback, useSyncExternalStore } from "react";

export const SAVED_STORAGE_KEY = "merkeb.saved";

const listeners = new Set<() => void>();
const EMPTY: string[] = [];

let cachedRaw: string | null = null;
let cachedIds: string[] = EMPTY;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// useSyncExternalStore needs a stable snapshot, so cache by the raw string.
function read(): string[] {
  try {
    const raw = window.localStorage.getItem(SAVED_STORAGE_KEY);
    if (raw === cachedRaw) return cachedIds;
    cachedRaw = raw;
    const parsed = raw ? JSON.parse(raw) : [];
    cachedIds = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : EMPTY;
  } catch {
    cachedIds = EMPTY;
  }
  return cachedIds;
}

function toggle(id: string) {
  const ids = read();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
  try {
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  emit();
}

export function useSavedIds(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useSaved(id: string) {
  const ids = useSavedIds();
  const toggleSaved = useCallback(() => toggle(id), [id]);
  return { saved: ids.includes(id), toggle: toggleSaved };
}
