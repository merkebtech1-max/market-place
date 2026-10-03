"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/il8n/LanguageProvider";
import type { Category } from "../types";

/** Category grid tile — compact circular photo icon plus label. */
export function CategoryCard({ category }: { category: Category }) {
  const { locale } = useLanguage();
  const name = locale === "am" ? category.nameAm : category.nameEn;

  return (
    <Link
      href={`/c/${category.slug}`}
      className="tap-target flex flex-col items-center gap-1.5 rounded-card border border-border bg-surface p-1.5 text-center transition-colors hover:border-primary/40 hover:bg-primary-soft/40 xs:p-2 sm:gap-2 sm:p-3"
    >
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-primary-soft sm:h-14 sm:w-14">
        <Image
          src={category.imageUrl}
          alt=""
          fill
          quality={90}
          sizes="56px"
          className="object-contain p-1"
        />
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink sm:text-xs">{name}</span>
    </Link>
  );
}

export function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 xs:grid-cols-3 xs:gap-2.5 md:grid-cols-6">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}
