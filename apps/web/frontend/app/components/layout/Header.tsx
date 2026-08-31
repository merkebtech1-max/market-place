"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { BellIcon, CartIcon, ChevronDownIcon, MapPinIcon, PlusCircleIcon } from "@/components/ui/Icon";
import { SearchInput } from "@/features/search/components/SearchInput";
import { localeShortLabels, locales } from "@/il8n/config";
import { useLanguage, useTranslations } from "@/il8n/LanguageProvider";
import { cn } from "@/lib/utils";

// Placeholder until the `auth` module (SRS §8.1) is wired up to real sessions.
const isAuthenticated = false;

function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLanguage();
  const t = useTranslations();

  return (
    <div
      role="group"
      aria-label={t("header.language")}
      className={cn(
        "flex items-center rounded-control border border-border bg-surface p-0.5 text-xs font-semibold",
        className
      )}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={cn(
            "tap-target rounded-[5px] px-2.5 py-1 transition-colors",
            locale === l ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
          )}
        >
          {localeShortLabels[l]}
        </button>
      ))}
    </div>
  );
}

function NotificationsButton() {
  const t = useTranslations();

  return (
    <Link
      href="/notifications"
      aria-label={t("header.notifications")}
      className="tap-target relative flex items-center justify-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-ink"
    >
      <BellIcon className="h-6 w-6" />
      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
    </Link>
  );
}

function CartButton() {
  const t = useTranslations();

  return (
    <Link
      href="/saved"
      aria-label={t("nav.saved")}
      className="tap-target flex items-center justify-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-ink"
    >
      <CartIcon className="h-5.5 w-5.5" />
    </Link>
  );
}

function LocationIndicator() {
  const { locale } = useLanguage();
  // Placeholder until the buyer's saved sub-city (SRS §3.3 FR-D4) is wired up.
  const label = locale === "am" ? "ቦሌ፣ አዲስ አበባ" : "Bole, Addis Ababa";

  return (
    <button
      type="button"
      className="hidden shrink-0 items-center gap-1 rounded-control px-2 py-1.5 text-sm font-medium text-ink hover:bg-ink/5 md:flex"
    >
      <MapPinIcon className="h-4 w-4 shrink-0 text-primary" />
      <span className="max-w-[8rem] truncate">{label}</span>
      <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
    </button>
  );
}

export function Header() {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-backdrop-filter:bg-surface/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1.5 px-4 sm:gap-2.5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold text-primary">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG mark; next/image's optimizer refuses local SVGs without extra config */}
          <img src="/logo.svg" alt={t("brand.name")} width={30} height={30} className="rounded-control" />
          <span className="hidden text-base sm:inline">{t("brand.name")}</span>
        </Link>

        <LocationIndicator />

        <SearchInput className="hidden flex-1 md:flex md:max-w-65 lg:max-w-sm" />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <LanguageSwitcher className="hidden sm:flex" />
          <NotificationsButton />
          <CartButton />
          <ButtonLink href="/sell" size="sm" className="hidden sm:inline-flex">
            <PlusCircleIcon className="h-4 w-4" />
            {t("header.sellShort")}
          </ButtonLink>
          {isAuthenticated ? (
            <Link href="/dashboard" aria-label={t("nav.account")} className="tap-target flex items-center">
              <Avatar name="You" size="sm" />
            </Link>
          ) : (
            <ButtonLink href="/sign-in" variant="outline" size="sm" className="hidden sm:inline-flex">
              {t("header.signIn")}
            </ButtonLink>
          )}
          <LanguageSwitcher className="sm:hidden" />
        </div>
      </div>

      <div className="border-t border-border px-4 py-1.5 md:hidden">
        <SearchInput />
      </div>
    </header>
  );
}
