import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListingCard } from "@/features/listings/components/ListingsCard";
import { T } from "@/il8n/T";
import type { Listing } from "@/features/listings/types";

function SearchOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5M8 8l6 6M14 8l-6 6" />
    </svg>
  );
}

/** Results grid + the search-specific empty state (SRS §16: "no listings match your filters"). */
export function SearchResults({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <EmptyState
        icon={<SearchOffIcon />}
        title={<T k="states.emptySearchTitle" />}
        body={<T k="states.emptySearchBody" />}
        action={
          <ButtonLink href="/search" variant="outline" size="sm">
            <T k="common.clearAll" />
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing, i) => (
        <ListingCard key={listing.id} listing={listing} priority={i < 4} />
      ))}
    </div>
  );
}
