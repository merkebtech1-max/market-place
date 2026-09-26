"use client";

import { useLanguage } from "@/il8n/LanguageProvider";
import type { Category } from "../types";

/** Locale-aware category name — the mock catalog only carries nameEn/nameAm, not a translation key. */
export function CategoryName({ category }: { category: Category }) {
  const { locale } = useLanguage();
  return <>{locale === "am" ? category.nameAm : category.nameEn}</>;
}
