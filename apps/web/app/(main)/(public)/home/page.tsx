import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { CategoryRail } from "@/features/catalog/components/CategoryCard";
import { HomeBrowseFilters } from "@/features/listings/components/HomeBrowseFilters";
import { PromotedRail } from "@/features/listings/components/PromotedRail";
import { SearchIcon } from "@/components/ui/Icon";
import { T } from "@/il8n/T";
import { categories, listings } from "@/lib/mock-data";

// Revalidate the feed periodically rather than on every request (SRS §6: SSR + ISR).
export const revalidate = 60;

const HOME_SUBCITY = "Bole";
const HOME_CITY = "Addis Ababa";

/** The functional marketplace home (SRS §6 `/`) — feed, categories, search. Reached via the splash's Get Started button and every in-app "Home" link. */
export default function MarketplaceHomePage() {
  const promoted = listings.filter(
    (l) => l.promotion === "homepage" || l.promotion === "featured" || l.promotion === "urgent"
  );

  return (
    <div className="pb-6 md:pb-10">
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <Image
          src="/hero.png"
          alt=""
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-ink/55" aria-hidden />
        <Container className="relative flex min-h-[16rem] flex-col items-center justify-center gap-3 px-2 py-10 text-center xs:min-h-[20rem] sm:min-h-[26rem] sm:gap-5 sm:py-16 md:min-h-[28rem]">
          <h1 className="max-w-xl text-xl font-bold leading-tight text-white drop-shadow-sm xs:text-2xl sm:text-3xl">
            <T k="home.heroTitle" />
          </h1>
          <p className="max-w-md text-sm text-white/90 sm:text-base">
            <T k="home.heroSubtitle" />
          </p>
          <ButtonLink href="/search" size="lg" className="w-full max-w-xs sm:w-auto sm:min-w-56">
            <SearchIcon className="h-5 w-5" />
            <T k="nav.search" />
          </ButtonLink>
        </Container>
      </section>

      <Container className="mt-8 space-y-10">
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
            <PromotedRail listings={promoted} />
          </section>
        )}

        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="mb-3 text-lg font-semibold text-ink">
            <T k="home.categoriesTitle" />
          </h2>
          <CategoryRail categories={categories} />
        </section>

        <HomeBrowseFilters
          listings={listings}
          defaultCity={HOME_CITY}
          defaultSubcity={HOME_SUBCITY}
        />
      </Container>
    </div>
  );
}
