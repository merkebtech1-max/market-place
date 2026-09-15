import { Container } from "@/components/layout/Container";
import { CategoryCardSkeleton, ListingGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function PublicLoading() {
  return (
    <div className="pb-10">
      <div className="border-b border-border py-10">
        <Container className="flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-11 w-full max-w-xl" />
        </Container>
      </div>
      <Container className="mt-8 space-y-10">
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-9">
          {Array.from({ length: 9 }).map((_, i) => (
            <CategoryCardSkeleton key={i} />
          ))}
        </div>
        <ListingGridSkeleton />
      </Container>
    </div>
  );
}
