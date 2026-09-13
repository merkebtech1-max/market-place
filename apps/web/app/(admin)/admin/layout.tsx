import { Container } from "@/components/layout/Container";

/** Admin is a separate authenticated area (SRS §3.7) — no public Header/MobileNav chrome. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="overflow-x-auto border-b border-border bg-ink px-3 py-3 text-sm font-semibold text-white sm:px-4">
        <Container>Merkeb Market · Admin</Container>
      </header>
      {children}
    </div>
  );
}
