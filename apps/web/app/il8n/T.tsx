"use client";

import { useTranslations } from "./LanguageProvider";

/**
 * Drop-in translated text for otherwise server-rendered trees (SRS §1.4:
 * bilingual from day one, "no text baked into images" — likewise none
 * baked into server output). Keeps pages like Home/Search SSR for SEO
 * while individual copy nodes stay locale-reactive.
 */
export function T({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  const t = useTranslations();
  return <>{t(k, vars)}</>;
}
