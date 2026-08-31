"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, InboxIcon, PlusCircleIcon, SearchIcon, UserIcon } from "@/components/ui/Icon";
import { useTranslations } from "@/il8n/LanguageProvider";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", key: "home", icon: HomeIcon, primary: false },
  { href: "/search", key: "search", icon: SearchIcon, primary: false },
  { href: "/sell", key: "sell", icon: PlusCircleIcon, primary: true },
  { href: "/messages", key: "messages", icon: InboxIcon, primary: false },
  { href: "/dashboard", key: "account", icon: UserIcon, primary: false },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Bottom tab bar — the primary mobile navigation (SRS §14.4: "Sell" always
 * visible, thumb-reachable). Hidden at md+ where the Header carries nav.
 */
export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <nav
      aria-label={t("nav.home")}
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {tabs.map(({ href, key, icon: Icon, primary }) => {
          const active = isActive(pathname, href);

          if (primary) {
            return (
              <li key={key} className="flex flex-1 items-center justify-center">
                <Link
                  href={href}
                  aria-label={t(`nav.${key}`)}
                  className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-elevation-2 transition-transform active:scale-95"
                >
                  <Icon className="h-7 w-7" />
                </Link>
              </li>
            );
          }

          return (
            <li key={key} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-ink-muted hover:text-ink"
                )}
              >
                <Icon className="h-5.5 w-5.5" strokeWidth={active ? 2.4 : 2} />
                {t(`nav.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
