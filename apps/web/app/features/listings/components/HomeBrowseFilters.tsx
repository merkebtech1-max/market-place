"use client";

import { useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagIcon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { ListingCard } from "@/features/listings/components/ListingsCard";
import type { Listing, ListingCondition } from "@/features/listings/types";
import { useTranslations } from "@/il8n/LanguageProvider";
import { subcitiesByCity } from "@/lib/mock-data";

const CONDITIONS: ListingCondition[] = ["new", "like_new", "good", "fair", "for_parts"];

/** Location + condition dropdowns under Browse categories; filters the home feed. */
export function HomeBrowseFilters({
  listings,
  defaultCity,
  defaultSubcity,
}: {
  listings: Listing[];
  defaultCity: string;
  defaultSubcity: string;
}) {
  const t = useTranslations();
  const subcityOptions = subcitiesByCity[defaultCity] ?? [];
  const [subcity, setSubcity] = useState(defaultSubcity);
  const [condition, setCondition] = useState<ListingCondition | "">("");

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (subcity && l.subcity !== subcity) return false;
      if (condition && l.condition !== condition) return false;
      return true;
    });
  }, [listings, subcity, condition]);

  return (
    <div className="space-y-6">
      <section aria-label={t("home.feedTitle", { location: subcity || defaultSubcity })}>
        <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <Select
            wrapperClassName="w-36 sm:w-44"
            value={subcity}
            onChange={(e) => setSubcity(e.target.value)}
            aria-label={t("search.location")}
          >
            <option value="">{t("search.anyLocation")}</option>
            {subcityOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <Select
            wrapperClassName="w-36 sm:w-44"
            value={condition}
            onChange={(e) => setCondition((e.target.value || "") as ListingCondition | "")}
            aria-label={t("search.condition")}
          >
            <option value="">{t("search.anyCondition")}</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {t(`condition.${c}`)}
              </option>
            ))}
          </Select>

          <ButtonLink
            href={`/search${condition ? `?${new URLSearchParams({ condition }).toString()}` : ""}`}
            variant="ghost"
            size="sm"
            className="ml-auto"
          >
            {t("common.seeAll")}
          </ButtonLink>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<TagIcon className="h-6 w-6" />}
            title={t("states.emptyFeedTitle")}
            body={t("states.emptyFeedBody")}
            action={
              <ButtonLink href="/sell" size="sm">
                {t("header.sellItem")}
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} priority={i < 4} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
