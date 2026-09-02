import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Ethiopic } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Footer } from "@/components/layout/Footer";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3730a3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={defaultLocale} className={`${notoSans.variable} ${notoSansEthiopic.variable}`}>
      <body className="flex min-h-screen flex-col bg-paper text-ink antialiased">
        <LanguageProvider>
          <Header />
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
          <Footer />
          <MobileNav />
        </LanguageProvider>
      </body>
    </html>
  );
}
