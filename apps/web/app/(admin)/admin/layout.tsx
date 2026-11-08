import { Container } from "@/components/layout/Container";
import Link from "next/link";

/** Admin is a separate authenticated area (SRS §3.7) — no public Header/MobileNav chrome. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="overflow-x-auto border-b border-border bg-ink px-3 py-3 text-sm font-semibold text-white sm:px-4">
        <Container className="flex min-w-max items-center gap-5">
          <Link href="/admin" className="text-base">Merkeb Market · Admin</Link>
          <nav aria-label="Admin navigation" className="flex gap-4 font-medium text-white/80">
            <Link href="/admin">Overview</Link>
            <Link href="/admin/moderation">Moderation</Link>
            <Link href="/admin/users">Users</Link>
            <Link href="/admin/audit-log">Audit log</Link>
            <Link href="/">Marketplace</Link>
          </nav>
        </Container>
      </header>
      {children}
    </div>
  );
}
