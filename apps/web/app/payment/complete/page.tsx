import Link from 'next/link';

export default function PaymentCompletePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-card border border-border bg-surface p-6 text-center">
        <h1 className="text-2xl font-bold text-ink">Payment submitted</h1>
        <p className="mt-3 text-ink-muted">
          MelaPays returned you to Merkeb. Payment verification is still pending, so the item has not been reserved yet.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/messages" className="rounded-control bg-primary px-4 py-3 font-semibold text-white">
            Return to messages
          </Link>
          <Link href="/reservations" className="rounded-control border border-border px-4 py-3 font-semibold text-ink">
            Reservations
          </Link>
        </div>
      </section>
    </main>
  );
}
