"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { saveListing, unsaveListing } from "./api";

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

function write(ids: string[]) {
  cachedIds = ids;
  cachedRaw = JSON.stringify(ids);
  try {
    window.localStorage.setItem(SAVED_STORAGE_KEY, cachedRaw);
  } catch {
    // The API remains the source of truth when storage is unavailable.
  }
  emit();
}

export function replaceSavedIds(ids: string[]) {
  write(ids);
}

async function toggle(id: string) {
  const ids = read();
  const wasSaved = ids.includes(id);
  const next = wasSaved ? ids.filter((x) => x !== id) : [id, ...ids];
  write(next);
  try {
    if (wasSaved) await unsaveListing(id);
    else await saveListing(id);
  } catch (error) {
    write(ids);
    throw error;
  }
}

export function useSavedIds(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useSaved(id: string, initialSaved = false) {
  const ids = useSavedIds();
  useEffect(() => {
    if (initialSaved && !read().includes(id)) write([id, ...read()]);
  }, [id, initialSaved]);
  const toggleSaved = useCallback(() => toggle(id), [id]);
  return { saved: ids.includes(id), toggle: toggleSaved };
}
