import { Container } from "@/components/layout/Container";
import { ListingGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function SearchLoading() {
  return (
    <Container className="py-6">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex items-start gap-6">
        <div className="hidden w-72 shrink-0 space-y-4 lg:block">
          <Skeleton className="h-80 w-full rounded-card" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-9 w-24 lg:hidden" />
            <Skeleton className="ml-auto h-11 w-56" />
          </div>
          <ListingGridSkeleton count={12} />
        </div>
      </div>
    </Container>
  );
}
