export type MessageKind = "text" | "offer" | "system" | "meetup";
export type OfferStatus = "pending" | "accepted" | "declined" | "countered";

export interface ChatMessage {
  id: string;
  mine: boolean;
  kind: MessageKind;
  body?: string;
  /** Integer ETB cents. */
  offerCents?: number;
  offerStatus?: OfferStatus;
  /** Previous amount in the negotiation, shown as price history. */
  previousCents?: number;
  /** Meetup proposal (FR-T4): place is `body`, time is `when`. */
  when?: string;
  meetupStatus?: "proposed" | "accepted";
  sentAt: string;
}

export interface Conversation {
  id: string;
  peerName: string;
  listingTitle: string;
  listingPriceCents: number;
  unread: number;
  role: "buying" | "selling";
  messages: ChatMessage[];
}
