"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { defaultLocale, LOCALE_STORAGE_KEY, type Locale } from "./config";
import en from "./messages/en.json";
import am from "./messages/am.json";

type Messages = typeof en;
type Vars = Record<string, string | number>;
type TranslateFn = (key: string, vars?: Vars) => string;

const dictionaries: Record<Locale, Messages> = { en, am };

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolve(dict: Messages, key: string): string | undefined {
  return key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined,
      dict
    ) as string | undefined;
}

function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : match
  );
}

// No cross-tab locale sync needed — this store only exists to read the
// persisted preference once on the client without a setState-in-effect.
function subscribe() {
  return () => {};
}

function getServerSnapshot(): Locale {
  return defaultLocale;
}

function readPersistedLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === "am" || stored === "en" ? stored : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  // Reconciles the SSR default with whatever the user last chose, using the
  // dedicated hook for "external state that may differ after hydration"
  // instead of an effect that calls setState on mount.
  const persistedLocale = useSyncExternalStore(subscribe, readPersistedLocale, getServerSnapshot);
  const [sessionLocale, setSessionLocale] = useState<Locale | null>(null);
  const locale = sessionLocale ?? initialLocale ?? persistedLocale;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setSessionLocale(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode) — the choice just won't persist.
    }
  };

  const t: TranslateFn = useMemo(() => {
    const dict = dictionaries[locale];
    return (key, vars) => {
      const value = resolve(dict, key) ?? resolve(dictionaries[defaultLocale], key) ?? key;
      return interpolate(value, vars);
    };
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

export function useTranslations() {
  return useLanguage().t;
}
