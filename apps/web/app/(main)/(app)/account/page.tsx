"use client";

import { Container } from "@/components/layout/Container";
import { AccountMenuContent } from "@/components/layout/AccountMenu";
import { SavedListings } from "@/features/listings/components/SavedListings";
import { T } from "@/il8n/T";
import { listings } from "@/lib/mock-data";

/** Mobile bottom-nav "Account" destination — same content as the header dropdown, plus saved items. */
export default function AccountPage() {
  return (
    <Container className="space-y-6 px-3 py-4 sm:py-8">
      <div className="mx-auto max-w-md overflow-hidden rounded-card border border-border bg-surface">
        <AccountMenuContent />
      </div>
      <section aria-labelledby="account-saved">
        <h2 id="account-saved" className="mb-3 text-base font-semibold text-ink">
          <T k="placeholder.savedTitle" />
        </h2>
        <SavedListings listings={listings} />
      </section>
    </Container>
  );
}
