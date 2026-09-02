"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { HeartIcon, MapPinIcon } from "@/components/ui/Icon";
import { useLanguage, useTranslations } from "@/il8n/LanguageProvider";
import { cn, formatETB, formatRelativeTime, listingHref } from "@/lib/utils";
import type { Listing } from "../types";

const promotionBadge: Record<NonNullable<Listing["promotion"]>, BadgeProps["variant"]> = {
  featured: "featured",
  urgent: "urgent",
  homepage: "featured",
};

function PromotionBadge({ listing }: { listing: Listing }) {
  const t = useTranslations();
  if (listing.status === "reserved") return <Badge variant="reserved">{t("badges.reserved")}</Badge>;
  if (listing.status === "sold") return <Badge variant="neutral">{t("badges.sold")}</Badge>;
  if (!listing.promotion) return null;
  const label = listing.promotion === "urgent" ? t("badges.urgent") : t("badges.featured");
  return <Badge variant={promotionBadge[listing.promotion]}>{label}</Badge>;
}

function SaveButton({ listing, className }: { listing: Listing; className?: string }) {
  const t = useTranslations();
  const [saved, setSaved] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`${saved ? t("common.saved") : t("common.save")}: ${listing.title}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaved((s) => !s);
      }}
      className={cn(
        "tap-target flex items-center justify-center rounded-full bg-white/90 text-ink shadow-elevation-1 backdrop-blur transition-colors hover:text-danger",
        saved && "text-danger",
        className
      )}
    >
      <HeartIcon filled={saved} className="h-5 w-5" />
    </button>
  );
}

export function ListingCard({
  listing,
  variant = "grid",
  priority = false,
}: {
  listing: Listing;
  variant?: "grid" | "list";
  priority?: boolean;
}) {
  const { locale } = useLanguage();
  const t = useTranslations();
  const cover = listing.images[0];
  const href = listingHref(listing.id, listing.title);

  if (variant === "list") {
    return (
      <Link
        href={href}
        className="group flex gap-3 rounded-card border border-border bg-surface p-2.5 transition-shadow hover:shadow-elevation-2"
      >
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-control bg-ink/5 sm:h-28 sm:w-28">
          {cover && (
            <Image
              src={cover.url}
              alt={listing.title}
              fill
              sizes="112px"
              className="object-cover"
            />
          )}
          <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
            <PromotionBadge listing={listing} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <p className="line-clamp-2 text-sm font-medium text-ink">{listing.title}</p>
          <p className="text-base font-semibold text-primary">{formatETB(listing.priceCents, locale)}</p>
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {listing.subcity}, {listing.city}
            </span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{formatRelativeTime(listing.publishedAt, locale)}</span>
          </p>
        </div>
        <SaveButton listing={listing} className="h-9 w-9 self-start" />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-card border border-border bg-surface transition-shadow hover:shadow-elevation-2"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-ink/5">
        {cover && (
          <Image
            src={cover.url}
            alt={listing.title}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <PromotionBadge listing={listing} />
          {listing.acceptsSwap && <Badge variant="swap">{t("badges.swap")}</Badge>}
        </div>
        <SaveButton listing={listing} className="absolute right-2 top-2 h-9 w-9" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 min-h-10 text-sm text-ink">{listing.title}</p>
        <p className="text-base font-semibold text-primary">{formatETB(listing.priceCents, locale)}</p>
        <p className="flex items-center gap-1 text-xs text-ink-muted">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{listing.subcity}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{formatRelativeTime(listing.publishedAt, locale)}</span>
        </p>
      </div>
    </Link>
  );
}
