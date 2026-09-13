import { SplashHeader } from "@/components/marketing/SplashHeader";
import { SplashFooter } from "@/components/marketing/SplashFooter";

/**
 * This group now holds only the splash page — its own minimal chrome, not
 * the app Header/Footer. Locked to exactly one viewport tall (`h-dvh` +
 * `overflow-hidden`) so nav, hero and footer all fit together with no
 * scrolling: the hero (`children`, flex-1) simply fills whatever space is
 * left between the fixed-height header and footer.
 */
export default function SplashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SplashHeader />
      <main className="min-h-0 flex-1">{children}</main>
      <SplashFooter />
    </div>
  );
}
