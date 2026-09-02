"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { ListingImage } from "../types";

export function ListingGallery({ images, title }: { images: ListingImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const image = images[active];

  function go(delta: number) {
    setActive((i) => (i + delta + images.length) % images.length);
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-card bg-ink/5">
        {image && (
          <Image
            key={image.id}
            src={image.url}
            alt={`${title} — photo ${active + 1} of ${images.length}`}
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="tap-target absolute left-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-elevation-1"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="tap-target absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-elevation-1"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
            <span className="absolute bottom-2 right-2 rounded-pill bg-ink/70 px-2 py-0.5 text-xs font-medium text-white">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-control border-2",
                i === active ? "border-primary" : "border-transparent"
              )}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
