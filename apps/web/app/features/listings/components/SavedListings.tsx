"use client";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeartIcon } from "@/components/ui/Icon";
import { T } from "@/il8n/T";
import type { Listing } from "../types";
import { useSavedIds } from "../saved";
import { ListingCard } from "./ListingsCard";

/** Shows the listings the user hearted, newest-saved first. */
export function SavedListings({ listings }: { listings: Listing[] }) {
  const ids = useSavedIds();
  const saved = ids
    .map((id) => listings.find((l) => String(l.id) === id))
    .filter((l): l is Listing => Boolean(l));

  if (saved.length === 0) {
    return (
      <EmptyState
        icon={<HeartIcon className="h-6 w-6" />}
        title={<T k="states.emptySavedTitle" />}
        body={<T k="states.emptySavedBody" />}
        action={
          <ButtonLink href="/home" variant="outline" size="sm">
            <T k="common.browseListings" />
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {saved.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
