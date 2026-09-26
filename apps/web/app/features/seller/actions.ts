import { getMyListing, replaceListing } from "./queries";
import { SellerListingError, type ListingEdit } from "./types";

/** Lifecycle transitions a seller may trigger (drafts publish; live listings sell). */
export async function markListingSold(id: string) {
  const l = await getMyListing(id);
  if (!l) throw new SellerListingError("not_found");
  if (l.status !== "active" && l.status !== "reserved") throw new SellerListingError("bad_transition");
  replaceListing({ ...l, status: "sold" });
}

export async function publishDraft(id: string) {
  const l = await getMyListing(id);
  if (!l) throw new SellerListingError("not_found");
  if (l.status !== "draft") throw new SellerListingError("bad_transition");
  replaceListing({ ...l, status: "active", publishedAt: new Date().toISOString() });
}

export async function updateMyListing(id: string, edit: ListingEdit) {
  const l = await getMyListing(id);
  if (!l) throw new SellerListingError("not_found");
  if (l.status === "sold") throw new SellerListingError("bad_transition");
  if (!edit.title.trim() || !Number.isInteger(edit.priceCents) || edit.priceCents <= 0) {
    throw new SellerListingError("invalid");
  }
  replaceListing({ ...l, ...edit, title: edit.title.trim(), description: edit.description.trim() });
}
