"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "@/il8n/LanguageProvider";

/** Auth screens: logo + platform name only. */
export function AuthBrandBar() {
  const t = useTranslations();

  return (
    <header className="relative z-20 flex h-14 items-center bg-transparent px-4 sm:px-6">
      <Link href="/" className="flex min-w-0 items-center gap-2 font-bold text-primary">
        <Image
          src="/image/logo.jpg"
          alt=""
          width={32}
          height={32}
          className="shrink-0 rounded-control object-cover"
        />
        <span className="truncate text-base sm:text-lg">{t("brand.name")}</span>
      </Link>
    </header>
  );
}
