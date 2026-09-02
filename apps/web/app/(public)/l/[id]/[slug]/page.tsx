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
import { getListingById, getSellerOtherListings, getSimilarListings } from "@/lib/mock-data";
import { formatETB, listingHref } from "@/lib/utils";
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

  const similar = getSimilarListings(listing);
  const sellerOther = getSellerOtherListings(listing.seller.id, listing.id);

  return (
    <Container className="py-6">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <ListingGallery images={listing.images} title={listing.title} />

          {/* Details block shown under the gallery on mobile, alongside on desktop via order */}
          <div className="space-y-4 lg:hidden">
            <ListingSummary listing={listing} />
          </div>

          <section aria-labelledby="description-heading" className="space-y-2">
            <h2 id="description-heading" className="text-base font-semibold text-ink">
              <T k="listing.description" />
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{listing.description}</p>
          </section>

          {listing.attributes && Object.keys(listing.attributes).length > 0 && (
            <section aria-labelledby="details-heading" className="space-y-2">
              <h2 id="details-heading" className="text-base font-semibold text-ink">
                <T k="listing.details" />
              </h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-card border border-border p-4 sm:grid-cols-3">
                {Object.entries(listing.attributes).map(([key, val]) => (
                  <div key={key}>
                    <dt className="text-xs text-ink-muted">{key}</dt>
                    <dd className="text-sm font-medium text-ink">{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

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

          {sellerOther.length > 0 && (
            <section aria-labelledby="seller-listings-heading">
              <h2 id="seller-listings-heading" className="mb-3 text-base font-semibold text-ink">
                <T k="listing.sellerListings" />
              </h2>
              <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                {sellerOther.map((l) => (
                  <div key={l.id} className="w-40 shrink-0 snap-start sm:w-48">
                    <ListingCard listing={l} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {similar.length > 0 && (
            <section aria-labelledby="similar-heading">
              <h2 id="similar-heading" className="mb-3 text-base font-semibold text-ink">
                <T k="listing.similar" />
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {similar.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <ListingSummary listing={listing} />
          </div>
        </div>
      </div>
    </Container>
  );
}

function ListingSummary({ listing }: { listing: Listing }) {
  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-4 shadow-elevation-1">
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

      <h1 className="text-lg font-semibold text-ink sm:text-xl">{listing.title}</h1>

      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-primary">
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

      <div className="grid grid-cols-2 gap-2">
        <ButtonLink href="/messages" size="lg">
          <T k="listing.messageSeller" />
        </ButtonLink>
        <ButtonLink href="/messages" variant="outline" size="lg">
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
