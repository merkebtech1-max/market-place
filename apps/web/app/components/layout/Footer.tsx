"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "@/il8n/LanguageProvider";
import { Container } from "./Container";

const columns = [
  {
    titleKey: "nav.home" as const,
    links: [
      { href: "/home", labelKey: "nav.home" as const },
      { href: "/search", labelKey: "home.browseListings" as const },
    ],
  },
];

/** Site footer — the only bottom chrome at every screen size, no separate tab bar. */
export function Footer() {
  const t = useTranslations();

  return (
    <footer className="mt-8 bg-primary text-white md:mt-12">
      <Container className="grid gap-6 py-8 sm:grid-cols-2 sm:gap-8 sm:py-10 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <Image
              src="/image/logo.jpg"
              alt=""
              width={32}
              height={32}
              className="shrink-0 rounded-control object-cover"
            />
            <span className="min-w-0">{t("brand.name")}</span>
          </div>
          <p className="max-w-xs text-sm text-white/70">{t("home.heroSubtitle")}</p>
        </div>

        {columns.map((col) => (
          <div key={col.titleKey}>
            <p className="mb-3 text-sm font-semibold text-white">{t(col.titleKey)}</p>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="tap-target inline-flex items-center text-sm text-white/70 hover:text-white">
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
      <div className="border-t border-white/15 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-white/60 md:pb-4">
        © {new Date().getFullYear()} {t("brand.name")}
      </div>
    </footer>
  );
}
