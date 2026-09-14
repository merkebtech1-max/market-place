"use client";

import { useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icon";
import { ListingCard } from "./ListingsCard";
import type { Listing } from "../types";

/**
 * Horizontal promoted listings — the shopper scrolls (or taps the arrows).
 * There is no autoplay; the rail only moves on user input.
 */
export function PromotedRail({ listings }: { listings: Listing[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-promoted-card]");
    const delta = (card?.offsetWidth ?? 200) + 12;
    el.scrollBy({ left: direction * delta, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-3 pb-2 sm:-mx-4 sm:px-4"
      >
        {listings.map((listing) => (
          <div
            key={listing.id}
            data-promoted-card
            className="w-[11rem] shrink-0 snap-start sm:w-52"
          >
            <ListingCard listing={listing} priority />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollByCard(-1)}
        aria-label="Scroll promoted listings left"
        className="tap-target absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/95 text-ink shadow-elevation-1 sm:flex"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollByCard(1)}
        aria-label="Scroll promoted listings right"
        className="tap-target absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/95 text-ink shadow-elevation-1 sm:flex"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
