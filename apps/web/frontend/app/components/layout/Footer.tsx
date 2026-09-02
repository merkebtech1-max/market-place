"use client";

import Link from "next/link";
import { useTranslations } from "@/il8n/LanguageProvider";
import { Container } from "./Container";

const columns = [
  {
    titleKey: "nav.home" as const,
    links: [
      { href: "/", labelKey: "nav.home" as const },
      { href: "/search", labelKey: "nav.search" as const },
      { href: "/services", labelKey: "header.sellItem" as const },
    ],
  },
];

/** Desktop-oriented footer; hidden below md where the bottom tab bar owns navigation. */
export function Footer() {
  const t = useTranslations();

  return (
    <footer className="mt-12 hidden bg-primary text-white md:block">
      <Container className="grid gap-8 py-10 sm:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG mark; next/image's optimizer refuses local SVGs without extra config */}
            <img src="/logo.svg" alt="" width={32} height={32} className="rounded-control" />
            {t("brand.name")}
          </div>
          <p className="max-w-xs text-sm text-white/70">{t("home.heroSubtitle")}</p>
        </div>

        {columns.map((col) => (
          <div key={col.titleKey}>
            <p className="mb-3 text-sm font-semibold text-white">{t(col.titleKey)}</p>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/70 hover:text-white">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="mb-3 text-sm font-semibold text-white">{t("listing.safetyTitle")}</p>
          <p className="max-w-xs text-sm text-white/70">{t("listing.safetyBody")}</p>
        </div>
      </Container>
      <div className="border-t border-white/15 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} {t("brand.name")}
      </div>
    </footer>
  );
}
