import { ButtonLink } from "@/components/ui/Button";
import { HeroCarousel, type HeroSlide } from "@/components/marketing/HeroCarousel";
import { LogInIcon, UserPlusIcon } from "@/components/ui/Icon";
import { T } from "@/il8n/T";

const heroSlides: HeroSlide[] = [
  {
    image: "/image/p2.png",
    alt: "Photographing polo shirts with a phone to list them for sale",
    title: <T k="home.slide1Title" />,
  },
  {
    image: "/image/p3.png",
    alt: "Photographing a t-shirt and shoes to list them for sale",
    title: <T k="home.slide2Title" />,
  },
  {
    image: "/image/p4.png",
    alt: "A buyer and seller exchanging an item at a market stall",
    title: <T k="home.slide3Title" />,
  },
  {
    image: "/image/p1.png",
    alt: "Shopper carrying colorful shopping bags",
    title: <T k="home.slide4Title" />,
  },
];

/**
 * The splash page — the first thing a visitor sees at the bare domain:
 * brand mark, the sliding photo statement, and a single way in. The
 * functional marketplace (search, categories, feed) lives at /home.
 */
export default function SplashPage() {
  return (
    <div className="flex h-full flex-col items-center sm:p-4">
      <HeroCarousel slides={heroSlides} className="h-full w-full sm:rounded-card">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <ButtonLink
            href="/sign-in?mode=login"
            size="lg"
            className="h-12 px-6 text-sm sm:h-14 sm:px-8 sm:text-base"
          >
            <LogInIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            <T k="home.login" />
          </ButtonLink>
          <ButtonLink
            href="/sign-in?mode=signup"
            variant="outline"
            size="lg"
            className="h-12 border-white/70 bg-white/10 px-6 text-sm text-white backdrop-blur-sm hover:bg-white/20 sm:h-14 sm:px-8 sm:text-base"
          >
            <UserPlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            <T k="home.createAccount" />
          </ButtonLink>
        </div>
      </HeroCarousel>
    </div>
  );
}
