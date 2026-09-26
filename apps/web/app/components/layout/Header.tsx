"use client";

import Image from "next/image";
import Link from "next/link";
import { useSavedIds } from "@/features/listings/saved";
import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { AccountMenu } from "@/components/layout/AccountMenu";
import {
  BellIcon,
  CartIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  MapPinIcon,
  PlusCircleIcon,
} from "@/components/ui/Icon";
import { SearchInput } from "@/features/search/components/SearchInput";
import { localeShortLabels, locales } from "@/il8n/config";
import { useLanguage, useTranslations } from "@/il8n/LanguageProvider";
import { cn } from "@/lib/utils";

function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLanguage();
  const t = useTranslations();

  return (
    <div
      role="group"
      aria-label={t("header.language")}
      className={cn(
        "flex items-center rounded-control border border-border bg-surface p-0.5 text-[11px] font-semibold sm:text-xs",
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
            "tap-target rounded-[5px] px-1.5 py-1 transition-colors sm:px-2.5",
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
  const count = useSavedIds().length;

  return (
    <Link
      href="/saved"
      aria-label={t("nav.saved")}
      className="tap-target relative flex items-center justify-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-ink"
    >
      <CartIcon className="h-5.5 w-5.5" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
          {count}
        </span>
      )}
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
  const pathname = usePathname();
  const isHome = pathname === "/home";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-backdrop-filter:bg-surface/80">
      <div className="mx-auto flex h-14 min-w-0 max-w-7xl items-center gap-1 px-3 sm:gap-2.5 sm:px-6">
        {!isHome && (
          <Link
            href="/home"
            aria-label={t("nav.home")}
            className="tap-target flex shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            <ChevronLeftIcon className="h-5.5 w-5.5" />
          </Link>
        )}

        <Link href="/home" className="flex min-w-0 shrink-0 items-center gap-2 font-bold text-primary">
          <Image
            src="/image/logo.jpg"
            alt={t("brand.name")}
            width={30}
            height={30}
            className="rounded-control object-cover"
          />
          <span className="hidden truncate text-base sm:inline">{t("brand.name")}</span>
        </Link>

        <LocationIndicator />

        <SearchInput className="hidden min-w-0 flex-1 md:flex md:max-w-65 lg:max-w-sm" />

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1.5">
          <LanguageSwitcher className="hidden sm:flex" />
          <span className="hidden xs:contents">
            <NotificationsButton />
            <CartButton />
          </span>
          <ButtonLink href="/sell" size="sm" className="hidden px-2.5 sm:inline-flex sm:px-3 md:inline-flex">
            <PlusCircleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("header.sellShort")}</span>
          </ButtonLink>
          <AccountMenu />
          <LanguageSwitcher className="sm:hidden" />
        </div>
      </div>

      <div className="border-t border-border px-3 py-2 md:hidden">
        <SearchInput />
      </div>
    </header>
  );
}
