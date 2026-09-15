import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Ethiopic } from "next/font/google";
import { LanguageProvider } from "@/il8n/LanguageProvider";
import { defaultLocale } from "@/il8n/config";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

const notoSansEthiopic = Noto_Sans_Ethiopic({
  subsets: ["ethiopic"],
  variable: "--font-ethiopic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Merkeb Market",
  description:
    "Buy and sell second-hand goods in your Ethiopian community — verified sellers, real prices, safe local meetups.",
  manifest: "/manifest.webmanifest",
  // Discourage Google's translate prompt too — same reasoning as translate="no" below.
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#006d77",
  viewportFit: "cover",
};

// Chrome (Header/Footer/MobileNav) lives in (main)/layout.tsx — the splash
// page at `/` intentionally skips it in favor of its own minimal header/footer.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the real locale (persisted client-side in
    // localStorage) can differ from this SSR default, and LanguageProvider
    // corrects `lang` on mount — that intentional one-time mismatch isn't a bug.
    // translate="no" + notranslate: the app has its own EN/AM toggle, so the
    // browser's built-in page translator (Edge/Chrome) should never rewrite
    // this DOM — when it does, its injected markup shows up as a hydration
    // mismatch since React never rendered the translated text.
    <html
      lang={defaultLocale}
      translate="no"
      suppressHydrationWarning
      className={`notranslate ${notoSans.variable} ${notoSansEthiopic.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-paper text-ink antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
