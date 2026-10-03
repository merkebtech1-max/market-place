import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { MapPinIcon, ShareIcon, ShieldIcon } from "@/components/ui/Icon";
import { ListingGallery } from "@/features/listings/components/ListingGallery";
import { ListingCard } from "@/features/listings/components/ListingsCard";
import { Price } from "@/features/listings/components/Price";
import { SellerHeader } from "@/features/profiles/components/SellerHeader";
import { T } from "@/il8n/T";
import { getListingById, getNearbyListings } from "@/lib/mock-data";
import { cn, formatETB, listingHref } from "@/lib/utils";
import type { Listing } from "@/features/listings/types";

type DetailPageProps = {
  params: Promise<{ id: string; slug: string }>;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-ET", { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(date)
  );
}

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = getListingById(id);
  if (!listing) return { title: "Listing not found — Merkeb Market" };

  const price = formatETB(listing.priceCents);
  const description = `${price} · ${listing.condition.replace("_", " ")} · ${listing.subcity}, ${listing.city}`;
  const image = listing.images[0]?.url;

  return {
    title: `${listing.title} — Merkeb Market`,
    description,
    alternates: { canonical: listingHref(listing.id, listing.title) },
    openGraph: {
      title: listing.title,
      description,
      images: image ? [{ url: image, width: 1200, height: 1200 }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: listing.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ListingDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const listing = getListingById(id);
  if (!listing) notFound();

  const nearby = getNearbyListings(listing);
  const nearbyLabel = `${listing.subcity}, ${listing.city}`;

  return (
    <Container className="py-4 sm:py-6">
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <ListingGallery images={listing.images} title={listing.title} />
        <div className="hidden md:block">
          <ListingSummary listing={listing} />
        </div>
      </div>

      <div className="mt-6 space-y-6 md:mt-8">
        <div className="space-y-4 md:hidden">
          <ListingSummary listing={listing} />
        </div>

        <section aria-labelledby="description-heading" className="space-y-2">
          <h2 id="description-heading" className="text-base font-semibold text-ink">
            <T k="listing.description" />
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{listing.description}</p>
        </section>

        <section aria-labelledby="details-heading" className="space-y-2">
          <h2 id="details-heading" className="text-base font-semibold text-ink">
            <T k="listing.details" />
          </h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-card border border-border p-3 xs:grid-cols-2 sm:grid-cols-3 sm:p-4">
            <div>
              <dt className="text-xs text-ink-muted">
                <T k="listing.category" />
              </dt>
              <dd className="text-sm font-medium text-ink">{listing.categoryName}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">
                <T k="listing.condition" />
              </dt>
              <dd className="text-sm font-medium text-ink">
                <T k={`condition.${listing.condition}`} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">
                <T k="listing.location" />
              </dt>
              <dd className="text-sm font-medium text-ink">
                {listing.subcity}, {listing.city}
                {listing.landmark ? ` · ${listing.landmark}` : ""}
              </dd>
            </div>
            {listing.attributes &&
              Object.entries(listing.attributes).map(([key, val]) => (
                <div key={key}>
                  <dt className="text-xs text-ink-muted">{key}</dt>
                  <dd className="text-sm font-medium text-ink">{val}</dd>
                </div>
              ))}
          </dl>
        </section>

        <section className="flex items-start gap-3 rounded-card border border-border bg-primary-soft/40 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">
              <T k="listing.safetyTitle" />
            </p>
            <p className="text-sm text-ink-muted">
              <T k="listing.safetyBody" />
            </p>
          </div>
        </section>

        <SellerHeader seller={listing.seller} variant="full" />

        {nearby.length > 0 && (
          <section aria-labelledby="nearby-heading" className="border-t border-border pt-6">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2 id="nearby-heading" className="text-base font-semibold text-ink">
                <T k="listing.nearby" vars={{ location: nearbyLabel }} />
              </h2>
              <p className="flex items-center gap-1 text-sm text-ink-muted">
                <MapPinIcon className="h-4 w-4 text-primary" />
                {nearbyLabel}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 md:grid-cols-4">
              {nearby.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Container>
  );
}

function ListingSummary({ listing, className }: { listing: Listing; className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-card border border-border bg-surface p-4 shadow-elevation-1", className)}>
      <div className="flex flex-wrap gap-1.5">
        {listing.status === "reserved" && (
          <Badge variant="reserved">
            <T k="badges.reserved" />
          </Badge>
        )}
        {listing.promotion === "urgent" && (
          <Badge variant="urgent">
            <T k="badges.urgent" />
          </Badge>
        )}
        {listing.promotion && listing.promotion !== "urgent" && (
          <Badge variant="featured">
            <T k="badges.featured" />
          </Badge>
        )}
        {listing.acceptsSwap && (
          <Badge variant="swap">
            <T k="badges.swap" />
          </Badge>
        )}
      </div>

      <h1 className="text-base font-semibold text-ink sm:text-xl">{listing.title}</h1>

      <div className="flex items-baseline gap-2">
        <p className="text-xl font-bold text-primary sm:text-2xl">
          <Price cents={listing.priceCents} />
        </p>
        {listing.isNegotiable && (
          <span className="text-sm text-ink-muted">
            · <T k="common.negotiable" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        <span className="flex items-center gap-1">
          <MapPinIcon className="h-4 w-4" />
          {listing.subcity}, {listing.city}
          {listing.landmark ? ` · ${listing.landmark}` : ""}
        </span>
        <span>
          <T k="listing.postedOn" vars={{ date: formatDate(listing.publishedAt) }} />
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
        <ButtonLink href="/messages" size="lg" className="whitespace-normal px-3 text-center text-sm">
          <T k="listing.messageSeller" />
        </ButtonLink>
        <ButtonLink href="/messages" variant="outline" size="lg" className="whitespace-normal px-3 text-center text-sm">
          <T k="listing.makeOffer" />
        </ButtonLink>
      </div>

      <button
        type="button"
        className="tap-target flex w-full items-center justify-center gap-2 rounded-control border border-border text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ShareIcon className="h-4 w-4" />
        <T k="common.share" />
      </button>

      <div className="border-t border-border pt-4">
        <SellerHeader seller={listing.seller} />
      </div>
    </div>
  );
}
