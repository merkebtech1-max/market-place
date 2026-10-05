import { authenticatedApiRequest } from "@/lib/auth";
import { SellerListingError, type ListingEdit } from "./types";

export async function publishDraft(id: string) {
  await authenticatedApiRequest(`/listings/${id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function updateMyListing(id: string, edit: ListingEdit) {
  if (!edit.title.trim() || !Number.isInteger(edit.priceCents) || edit.priceCents <= 0) {
    throw new SellerListingError("invalid");
  }
  await authenticatedApiRequest(`/listings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: edit.title.trim(),
      description: edit.description.trim(),
      priceCents: edit.priceCents,
      isNegotiable: edit.isNegotiable,
      attributes: { acceptsSwap: edit.acceptsSwap },
    }),
  });
}

export async function deleteMyListing(id: string) {
  await authenticatedApiRequest(`/listings/${id}`, { method: "DELETE" });
}
