import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RatingStars } from "@/features/reviews/components/RatingsStars";
import type { ListingSeller } from "@/features/listings/types";

/** Seller identity block — compact for the listing sidebar, full for /u/[handle]. */
export function SellerHeader({
  seller,
  variant = "compact",
}: {
  seller: ListingSeller;
  variant?: "compact" | "full";
}) {
  return (
    <div className={variant === "full" ? "flex items-center gap-4" : "flex items-center gap-3"}>
      <Avatar name={seller.displayName} src={seller.avatarUrl} size={variant === "full" ? "lg" : "md"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/u/${seller.handle}`} className="truncate font-semibold text-ink hover:underline">
            {seller.displayName}
          </Link>
          {seller.isVerified && <Badge variant="primary">Verified</Badge>}
          {seller.isPremium && <Badge variant="featured">Premium</Badge>}
        </div>
        <RatingStars value={seller.ratingAvg} count={seller.ratingCount} />
      </div>
    </div>
  );
}
