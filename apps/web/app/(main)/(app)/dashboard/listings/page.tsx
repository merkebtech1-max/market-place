import { Suspense } from "react";
import { SellerListings } from "@/features/seller/components/SellerListings";

export default function DashboardListingsPage() {
  return (
    <Suspense>
      <SellerListings />
    </Suspense>
  );
}
