"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icon";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export interface HeroSlide {
  image: string;
  alt: string;
  title: ReactNode;
  subtitle?: ReactNode;
}

// Faster pace per feedback — still readable, just brisker than before.
const AUTOPLAY_MS = 3200;

/**
 * Full-bleed image carousel for the home hero: photos slide in horizontally,
 * the active photo gets a slow Ken Burns zoom, and each slide carries its
 * own headline that cross-fades in step with the photo change. `children`
 * (search bar + CTAs) stays fixed on top so it doesn't shift between slides.
 */
export function HeroCarousel({
  slides,
  children,
  className,
}: {
  slides: HeroSlide[];
  children?: ReactNode;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (paused || reducedMotion || slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, reducedMotion, slides.length]);

  function go(delta: number) {
    setIndex((i) => (i + delta + slides.length) % slides.length);
  }

  return (
    <section
      className={cn("relative overflow-hidden bg-ink", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {/* Sliding photos */}
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div key={slide.image} className="relative h-full w-full shrink-0" aria-hidden={i !== index}>
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              priority={i === 0}
              quality={90}
              sizes="100vw"
              className={cn(
                "object-cover",
                i === index && !reducedMotion && "animate-[kenburns_5s_ease-out_forwards]"
              )}
            />
            <div className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/25 to-ink/10" />
          </div>
        ))}
      </div>

      {/* Per-slide headline: the photo slides horizontally, the text moves on
          its own vertical axis instead — fading up into place, fading down
          out. Every slide's text block sits at the same inset-0 box, so only
          opacity/translate differ between them and they overlap into one
          transition. */}
      <div className="pointer-events-none absolute inset-0">
        {slides.map((slide, i) => (
          <div
            key={slide.image}
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center px-4 text-center transition-[opacity,transform] duration-500 ease-out sm:px-10 md:px-14",
              i === index ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}
          >
            <div className="mx-auto max-w-lg">
              <h1 className="text-xl font-bold text-white drop-shadow-sm xs:text-2xl sm:text-3xl md:text-4xl">
                {slide.title}
              </h1>
              {slide.subtitle && (
                <p className="mt-2 text-sm text-white/90 sm:text-base">{slide.subtitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fixed overlay content (search bar, CTAs) */}
      {children && (
        <div className="absolute inset-x-0 bottom-14 flex flex-col items-center gap-3 px-4 sm:bottom-13 sm:px-6">
          {children}
        </div>
      )}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
          {slides.map((slide, i) => (
            <button
              key={slide.image}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-1.5 rounded-pill transition-all",
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"
              )}
            />
          ))}
        </div>
      )}

      {/* Prev / next */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="tap-target absolute left-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:left-4"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next slide"
            className="tap-target absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:right-4"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </>
      )}
    </section>
  );
}
