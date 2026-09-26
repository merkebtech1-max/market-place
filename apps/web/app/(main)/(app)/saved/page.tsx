import { Container } from "@/components/layout/Container";
import { SavedListings } from "@/features/listings/components/SavedListings";
import { T } from "@/il8n/T";
import { listings } from "@/lib/mock-data";

export default function SavedPage() {
  return (
    <Container className="py-4 sm:py-6">
      <h1 className="mb-5 text-lg font-semibold text-ink sm:text-xl">
        <T k="placeholder.savedTitle" />
      </h1>
      <SavedListings listings={listings} />
    </Container>
  );
}
