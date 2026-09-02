import { Container } from "@/components/layout/Container";

/** Admin is a separate authenticated area (SRS §3.7) — no public Header/MobileNav chrome. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border bg-ink px-4 py-3 text-sm font-semibold text-white">
        <Container>Merkeb Market · Admin</Container>
      </header>
      {children}
    </div>
  );
}
