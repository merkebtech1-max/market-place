"use client";

import { use } from "react";
import { EditListing } from "@/features/seller/components/EditListing";

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EditListing id={id} />;
}
