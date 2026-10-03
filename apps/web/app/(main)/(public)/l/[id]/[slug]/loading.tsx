import { Container } from "@/components/layout/Container";
import { ListingDetailSkeleton } from "@/components/ui/Skeleton";

export default function ListingDetailLoading() {
  return (
    <Container className="py-6">
      <ListingDetailSkeleton />
    </Container>
  );
}
