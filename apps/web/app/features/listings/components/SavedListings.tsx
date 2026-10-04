"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeartIcon } from "@/components/ui/Icon";
import { T } from "@/il8n/T";
import type { Listing } from "../types";
import { getSavedListings } from "../api";
import { replaceSavedIds } from "../saved";
import { ListingCard } from "./ListingsCard";

/** Shows the listings the user hearted, newest-saved first. */
export function SavedListings() {
  const [saved, setSaved] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSavedListings()
      .then((listings) => {
        setSaved(listings);
        replaceSavedIds(listings.map((listing) => listing.id));
      })
      .catch(() => setSaved([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-card bg-ink/5" />;
  }

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
