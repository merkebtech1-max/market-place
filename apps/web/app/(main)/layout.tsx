import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

/** Full app chrome — header and footer only; no separate bottom tab bar on small screens. */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-w-0 flex-1">{children}</main>
      <Footer />
    </>
  );
}
