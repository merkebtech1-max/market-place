"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/features/auth/session";
import { useLanguage } from "@/il8n/LanguageProvider";
import { getMyListings } from "../queries";
import { SELLER_TABS, type SellerCounts } from "../types";

/** Dashboard home: listing counts per lifecycle state, each linking to its tab. */
export function SellerOverview() {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useSession();
  const [counts, setCounts] = useState<SellerCounts | null>(null);

  useEffect(() => {
    getMyListings("all").then((d) => setCounts(d.counts));
  }, []);

  if (!isAuthenticated) {
    return (
      <Container className="max-w-md px-3 py-10 text-center">
        <p className="mb-3 text-sm text-ink-muted">{t("dashboard.signInBody")}</p>
        <ButtonLink href="/sign-in?mode=login">{t("header.signIn")}</ButtonLink>
      </Container>
    );
  }

  return (
    <Container className="max-w-3xl px-3 py-4 sm:py-8">
      <h1 className="text-xl font-bold text-ink">{t("dashboard.title")}</h1>
      <p className="mb-4 text-sm text-ink-muted">{t("dashboard.welcome", { name: user?.name ?? "" })}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SELLER_TABS.map((k) => (
          <li key={k}>
            <Link
              href={k === "all" ? "/dashboard/listings" : `/dashboard/listings?status=${k}`}
              className="block rounded-card border border-border bg-surface p-4 hover:bg-primary-soft/40"
            >
              <span className="block text-sm text-ink-muted">{t(`dashboard.tabs.${k}`)}</span>
              {counts ? (
                <span className="text-2xl font-bold text-ink">{counts[k]}</span>
              ) : (
                <Skeleton className="mt-1 h-8 w-10" />
              )}
            </Link>
          </li>
        ))}
      </ul>
      <ButtonLink href="/sell" className="mt-4" fullWidth>
        {t("dashboard.newListing")}
      </ButtonLink>
    </Container>
  );
}
