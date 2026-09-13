"use client";

import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { LogInIcon } from "@/components/ui/Icon";
import { useTranslations } from "@/il8n/LanguageProvider";

/** Minimal nav for the splash page — the platform name plus a single Sign in button, nothing else. */
export function SplashHeader() {
  const t = useTranslations();

  return (
    <header className="flex h-12 min-w-0 items-center justify-between gap-2 px-3 sm:h-14 sm:px-6">
      <Link href="/" className="flex min-w-0 shrink items-center gap-2 font-bold text-primary">
        <Image
          src="/image/logo.jpg"
          alt=""
          width={30}
          height={30}
          className="shrink-0 rounded-control object-cover"
        />
        <span className="truncate text-base">{t("brand.name")}</span>
      </Link>
      <ButtonLink href="/sign-in?mode=login" size="sm" className="shrink-0 px-2.5 sm:px-3">
        <LogInIcon className="h-4 w-4" />
        {t("header.signIn")}
      </ButtonLink>
    </header>
  );
}
