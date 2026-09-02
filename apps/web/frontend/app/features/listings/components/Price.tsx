"use client";

import { useLanguage } from "@/il8n/LanguageProvider";
import { formatETB } from "@/lib/utils";

/** Locale-reactive ETB price for otherwise server-rendered listing pages. */
export function Price({ cents }: { cents: number }) {
  const { locale } = useLanguage();
  return <>{formatETB(cents, locale)}</>;
}
