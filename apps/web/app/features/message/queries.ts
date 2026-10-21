import { getListingById } from "@/lib/mock-data";
import type { Conversation } from "./types";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** Mock backend seam — swap for the `/messages` API (Socket.IO + polling fallback) later. */
function seed(): Conversation[] {
  return [
    {
      id: "c1",
      peerName: "Abebe Kebede",
      listingTitle: "Samsung Galaxy A54 – 128GB",
      listingPriceCents: 4_500_000,
      unread: 2,
      role: "selling",
      messages: [
        { id: "m1", mine: false, kind: "text", body: "ሰላም! ስልኩ አሁንም አለ?", sentAt: ago(50) },
        { id: "m2", mine: true, kind: "text", body: "አዎ አለ። ማየት ይፈልጋሉ?", sentAt: ago(45) },
        { id: "m3", mine: false, kind: "offer", offerCents: 4_000_000, offerStatus: "pending", sentAt: ago(30) },
      ],
    },
    {
      id: "c2",
      peerName: "Hana Tesfaye",
      listingTitle: "Mountain bicycle",
      listingPriceCents: 550_000,
      unread: 0,
      role: "buying",
      messages: [
        { id: "m1", mine: true, kind: "text", body: "Is it still available?", sentAt: ago(1500) },
        { id: "m2", mine: false, kind: "text", body: "Yes, come see it in Bole.", sentAt: ago(1400) },
        { id: "m3", mine: true, kind: "offer", offerCents: 450_000, offerStatus: "declined", sentAt: ago(1300) },
      ],
    },
    {
      id: "c3",
      peerName: "Dawit Alemu",
      listingTitle: "Wooden dining table",
      listingPriceCents: 1_200_000,
      unread: 0,
      role: "buying",
      messages: [
        { id: "m1", mine: true, kind: "offer", offerCents: 900_000, offerStatus: "countered", sentAt: ago(300) },
        { id: "m2", mine: false, kind: "offer", offerCents: 1_050_000, offerStatus: "pending", previousCents: 900_000, sentAt: ago(200) },
      ],
    },
  ];
}

export async function getConversations() {
  return seed();
}

export async function getConversation(id: string) {
  // `l-<listingId>` opens (or starts) the buyer's conversation about that listing.
  if (id.startsWith("l-")) {
    const listing = getListingById(id.slice(2));
    if (!listing) return null;
    return {
      id,
      peerName: listing.seller.displayName,
      listingTitle: listing.title,
      listingPriceCents: listing.priceCents,
      unread: 0,
      role: "buying",
      messages: [],
    } satisfies Conversation;
  }
  return seed().find((c) => c.id === id) ?? null;
}
