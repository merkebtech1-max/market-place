"use client";

import Link from "next/link";
import { useLanguage } from "@/il8n/LanguageProvider";
import type { Category } from "../types";

/** Category grid tile, used on Home (SRS §3.3 FR-D6) and as a filter shortcut. */
export function CategoryCard({ category }: { category: Category }) {
  const { locale } = useLanguage();
  const name = locale === "am" ? category.nameAm : category.nameEn;

  return (
    <Link
      href={`/c/${category.slug}`}
      className="tap-target flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-xl"
      >
        {category.icon}
      </span>
      <span className="line-clamp-2 text-xs font-medium text-ink">{name}</span>
    </Link>
  );
}

export function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-9">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}
