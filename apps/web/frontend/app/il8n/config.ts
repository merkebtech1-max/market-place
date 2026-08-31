export const locales = ["am", "en"] as const;
export type Locale = (typeof locales)[number];

/** SRS §1.4: Amharic is the default locale. */
export const defaultLocale: Locale = "am";

export const localeLabels: Record<Locale, string> = {
  am: "አማርኛ",
  en: "English",
};

/** Compact codes for tight spaces like the header toggle. */
export const localeShortLabels: Record<Locale, string> = {
  am: "Amh",
  en: "En",
};

export const LOCALE_STORAGE_KEY = "merkeb.locale";
