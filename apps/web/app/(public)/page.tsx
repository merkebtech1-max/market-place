import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryRail } from "@/features/catalog/components/CategoryCard";
import { ListingCard } from "@/features/listings/components/ListingsCard";
import { T } from "@/il8n/T";
import { categories, listings } from "@/lib/mock-data";

// Revalidate the feed periodically rather than on every request (SRS §6: SSR + ISR).
export const revalidate = 60;

const HOME_SUBCITY = "Bole";
const HOME_CITY = "Addis Ababa";

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path d="M3 12 12 3h6a2 2 0 0 1 2 2v6l-9 9a1.5 1.5 0 0 1-2 0L3 14a1.5 1.5 0 0 1 0-2Z" />
    </svg>
  );
}

export default function HomePage() {
  const promoted = listings.filter((l) => l.promotion === "homepage" || l.promotion === "featured");
  const nearby = listings.filter((l) => l.city === HOME_CITY);

  return (
    <div className="pb-10">
      {/* Hero */}
      <section className="border-b border-border bg-linear-to-b from-primary-soft/60 to-paper">
        <Container className="flex flex-col items-center gap-5 py-10 text-center sm:py-14">
          <h1 className="max-w-xl text-2xl font-bold text-ink sm:text-3xl">
            <T k="home.heroTitle" />
          </h1>
          <p className="max-w-md text-sm text-ink-muted sm:text-base">
            <T k="home.heroSubtitle" />
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ButtonLink href="/sell" size="lg">
              <T k="header.sellItem" />
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Container className="mt-8 space-y-10">
        {/* Promoted rail (SRS §11: paid placement, clearly labelled, never displacing organic relevance) */}
        {promoted.length > 0 && (
          <section aria-labelledby="promoted-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="promoted-heading" className="flex items-center gap-2 text-lg font-semibold text-ink">
                <T k="home.promotedTitle" />
                <Badge variant="featured">
                  <T k="badges.featured" />
                </Badge>
              </h2>
            </div>
            <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
              {promoted.map((listing) => (
                <div key={listing.id} className="w-40 shrink-0 snap-start sm:w-48">
                  <ListingCard listing={listing} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section id="categories" aria-labelledby="categories-heading" className="scroll-mt-28">
          <h2 id="categories-heading" className="mb-3 text-lg font-semibold text-ink">
            <T k="home.categoriesTitle" />
          </h2>
          <CategoryRail categories={categories} />
        </section>

        {/* Fresh nearby feed */}
        <section aria-labelledby="feed-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="feed-heading" className="text-lg font-semibold text-ink">
              <T k="home.feedTitle" vars={{ location: HOME_SUBCITY }} />
            </h2>
            <ButtonLink href="/search" variant="ghost" size="sm">
              <T k="common.seeAll" />
            </ButtonLink>
          </div>

          {nearby.length === 0 ? (
            <EmptyState
              icon={<TagIcon />}
              title={<T k="states.emptyFeedTitle" />}
              body={<T k="states.emptyFeedBody" />}
              action={
                <ButtonLink href="/sell" size="sm">
                  <T k="header.sellItem" />
                </ButtonLink>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {nearby.map((listing, i) => (
                <ListingCard key={listing.id} listing={listing} priority={i < 4} />
              ))}
            </div>
          )}
        </section>
      </Container>
    </div>
  );
}
