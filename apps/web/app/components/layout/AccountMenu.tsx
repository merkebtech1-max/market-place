"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import {
  BookmarkIcon,
  ChatIcon,
  ChevronRightIcon,
  HelpCircleIcon,
  LogOutIcon,
  PackageIcon,
  UserIcon,
} from "@/components/ui/Icon";
import { useSavedIds } from "@/features/listings/saved";
import { useTranslations } from "@/il8n/LanguageProvider";
import {
  getIsAuthenticated,
  getServerIsAuthenticated,
  logoutCurrentSession,
  subscribeAuthSession,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

type Item = { href: string; key: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

/** Single source of truth for account navigation — the routes already exist elsewhere. */
export const accountItems: Item[] = [
  { href: "/dashboard/listings", key: "myListings", icon: PackageIcon },
  { href: "/saved", key: "saved", icon: BookmarkIcon },
  { href: "/messages", key: "messages", icon: ChatIcon },
  { href: "/reservations", key: "reservations", icon: PackageIcon },
];

const rowClass =
  "tap-target flex w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-primary-soft/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

function Row({ href, icon: Icon, label, badge, onNavigate }: { href: string; icon: Item["icon"]; label: string; badge?: number; onNavigate?: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className={rowClass}>
      <Icon className="h-5 w-5 shrink-0 text-ink-muted" />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Menu body — shared by the header dropdown and the mobile `/account` page. */
export function AccountMenuContent({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAuthenticated = useSyncExternalStore(
    subscribeAuthSession,
    getIsAuthenticated,
    getServerIsAuthenticated
  );
  const savedCount = useSavedIds().length;

  if (!isAuthenticated) {
    return (
      <div className="space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold text-ink">{t("account.signedOutTitle")}</p>
          <p className="text-xs text-ink-muted">{t("account.signedOutBody")}</p>
        </div>
        <Link
          href="/sign-in?mode=login"
          onClick={onNavigate}
          className="tap-target flex items-center justify-center rounded-control bg-primary text-sm font-medium text-white hover:bg-primary-hover"
        >
          {t("header.signIn")}
        </Link>
        <Link
          href="/sign-in?mode=signup"
          onClick={onNavigate}
          className="tap-target flex items-center justify-center rounded-control border border-border text-sm font-medium text-ink hover:bg-primary-soft/60"
        >
          {t("account.createAccount")}
        </Link>
        <Row href="/support" icon={HelpCircleIcon} label={t("account.support")} onNavigate={onNavigate} />
      </div>
    );
  }

  async function handleSignOut() {
    setIsLoggingOut(true);
    try {
      await logoutCurrentSession();
      onNavigate?.();
      router.push("/sign-in?mode=login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div>
      <Link
        href="/account"
        onClick={onNavigate}
        className="flex items-center gap-3 border-b border-border p-4 hover:bg-primary-soft/40"
      >
        <Avatar name="You" size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{t("nav.account")}</span>
          <span className="block text-xs text-ink-muted">{t("account.viewAccount")}</span>
        </span>
        <ChevronRightIcon className="h-4 w-4 text-ink-muted" />
      </Link>
      <nav aria-label={t("nav.account")} className="space-y-0.5 p-1.5">
        {accountItems.map(({ href, key, icon }) => (
          <Row key={key} href={href} icon={icon} label={t(`account.${key}`)} badge={key === "saved" ? savedCount : undefined} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-border p-1.5">
        <Row href="/support" icon={HelpCircleIcon} label={t("account.support")} onNavigate={onNavigate} />
        <button type="button" onClick={handleSignOut} disabled={isLoggingOut} className={cn(rowClass, "text-danger")}>
          <LogOutIcon className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-left">{t("account.signOut")}</span>
        </button>
      </div>
    </div>
  );
}

/** Header trigger + popover. Closes on outside press, Escape, or navigation. */
export function AccountMenu() {
  const t = useTranslations();
  const isAuthenticated = useSyncExternalStore(
    subscribeAuthSession,
    getIsAuthenticated,
    getServerIsAuthenticated
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="sm:relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("nav.account")}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="account-menu"
        onClick={() => setOpen((o) => !o)}
        className="tap-target flex items-center justify-center rounded-full transition-transform hover:scale-[1.04] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {isAuthenticated ? (
          <Avatar name="You" size="md" mode="letter" />
        ) : (
          <UserIcon className="h-5.5 w-5.5 text-ink-muted" />
        )}
      </button>
      {open && (
        <div
          id="account-menu"
          className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-card border border-border bg-surface shadow-elevation-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72"
        >
          <AccountMenuContent onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
