"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PackageIcon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/features/auth/session";
import { useLanguage } from "@/il8n/LanguageProvider";
import { cn, formatETB, listingHref } from "@/lib/utils";
import { markListingSold, publishDraft } from "../actions";
import { getMyListings } from "../queries";
import { SELLER_TABS, type SellerCounts, type SellerListing, type SellerTab } from "../types";

const STATUS_BADGE = {
  draft: "neutral",
  active: "success",
  reserved: "reserved",
  sold: "primary",
} as const;

export function SellerListings() {
  const { t, locale } = useLanguage();
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("status");
  const tab: SellerTab = SELLER_TABS.find((k) => k === raw) ?? "all";

  const [data, setData] = useState<{ items: SellerListing[]; counts: SellerCounts } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => getMyListings(tab).then(setData), [tab]);

  useEffect(() => {
    // Fetch on tab change; the mock seam resolves immediately.
    void load();
  }, [load]);

  const selectTab = (k: SellerTab) => {
    setData(null);
    router.replace(k === "all" ? pathname : `${pathname}?status=${k}`, { scroll: false });
  };

  const markSold = async (l: SellerListing) => {
    await markListingSold(l.id);
    setNotice(t("dashboard.soldDone", { title: l.title }));
    await load();
  };

  const publish = async (l: SellerListing) => {
    await publishDraft(l.id);
    setNotice(t("dashboard.publishedDone", { title: l.title }));
    await load();
  };

  if (!isAuthenticated) {
    return (
      <Container className="max-w-md px-3 py-10">
        <EmptyState
          icon={<PackageIcon />}
          title={t("dashboard.signInTitle")}
          body={t("dashboard.signInBody")}
          action={<ButtonLink href="/sign-in?mode=login">{t("header.signIn")}</ButtonLink>}
        />
      </Container>
    );
  }

  return (
    <Container className="max-w-3xl px-3 py-4 sm:py-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">{t("dashboard.listingsTitle")}</h1>
        <ButtonLink href="/sell" size="sm">
          {t("header.sellShort")}
        </ButtonLink>
      </div>

      <div role="tablist" aria-label={t("dashboard.listingsTitle")} className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {SELLER_TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => selectTab(k)}
            className={cn(
              "tap-target shrink-0 rounded-full px-4 text-sm font-medium",
              tab === k ? "bg-primary text-white" : "bg-primary-soft text-primary"
            )}
          >
            {t(`dashboard.tabs.${k}`)}
            {data && <span className="ml-1.5 text-xs opacity-80">{data.counts[k]}</span>}
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className="mb-3 rounded-control bg-success-soft px-3 py-2 text-sm text-ink">
          {notice}
        </p>
      )}

      {!data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title={t("dashboard.emptyTitle")}
          body={t(`dashboard.empty.${tab}`)}
          action={
            <ButtonLink href="/sell" size="sm">
              {t("header.sellShort")}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="space-y-3">
          {data.items.map((l) => {
            const cover = l.images[0];
            const canEdit = l.status !== "sold";
            const canSell = l.status === "active" || l.status === "reserved";
            return (
              <li key={l.id} className="flex gap-3 rounded-card border border-border bg-surface p-3">
                <Link href={listingHref(l.id, l.title)} className="shrink-0">
                  {cover ? (
                    <Image
                      src={cover.url}
                      alt=""
                      width={96}
                      height={96}
                      className="h-20 w-20 rounded-control object-cover sm:h-24 sm:w-24"
                    />
                  ) : (
                    <span className="block h-20 w-20 rounded-control bg-ink/5 sm:h-24 sm:w-24" />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold text-ink">{l.title}</p>
                    <Badge variant={STATUS_BADGE[l.status as keyof typeof STATUS_BADGE] ?? "neutral"} className="shrink-0">
                      {t(`dashboard.status.${l.status}`)}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold text-primary">{formatETB(l.priceCents, locale)}</p>
                  <p className="text-xs text-ink-muted">
                    {t("dashboard.stats", { views: l.viewCount, saves: l.saveCount })}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {canEdit && (
                      <ButtonLink href={`/dashboard/listings/${l.id}/edit`} variant="outline" size="sm">
                        {t("dashboard.edit")}
                      </ButtonLink>
                    )}
                    {l.status === "draft" && (
                      <Button size="sm" onClick={() => publish(l)}>
                        {t("dashboard.publish")}
                      </Button>
                    )}
                    {canSell && (
                      <Button size="sm" variant="secondary" onClick={() => markSold(l)}>
                        {t("dashboard.markSold")}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

    </Container>
  );
}
