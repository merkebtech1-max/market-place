"use client";

import { useTranslations } from "@/il8n/LanguageProvider";

/** Minimal footer for the splash page — brand mark and copyright only. */
export function SplashFooter() {
  const t = useTranslations();

  return (
    <footer className="flex flex-col items-center gap-1 px-4 py-6 text-center">
      <span className="font-bold text-primary">{t("brand.name")}</span>
      <span className="text-xs text-ink-muted">
        © {new Date().getFullYear()} {t("brand.name")}
      </span>
    </footer>
  );
}
