import { authenticatedApiRequest, getAuthSession } from "@/lib/auth";
import type { ChatMessage, Conversation, OfferStatus } from "./types";

type ApiMessage = {
  id: string;
  senderId: string;
  body: string;
  type: "TEXT" | "SYSTEM";
  createdAt: string;
};

type ApiThread = {
  id: string;
  role: "buying" | "selling";
  listing: { id: string; title: string; priceCents: number };
  counterparty: { id: string; displayName: string; avatarKey: string | null };
  lastMessage: ApiMessage | null;
};

const OFFER_PREFIX = "[[MERKEB_OFFER_V1]]";
const OFFER_RESPONSE_PREFIX = "[[MERKEB_OFFER_RESPONSE_V1]]";

export function encodeOfferMessage(
  offerCents: number,
  previousCents?: number,
  replacesId?: string,
): string {
  return `${OFFER_PREFIX}${JSON.stringify({
    offerCents,
    ...(previousCents === undefined ? {} : { previousCents }),
    ...(replacesId === undefined ? {} : { replacesId }),
  })}`;
}

export function encodeOfferResponse(
  offerId: string,
  status: "accepted" | "declined",
): string {
  return `${OFFER_RESPONSE_PREFIX}${JSON.stringify({ offerId, status })}`;
}

function parseOfferMessage(body: string): {
  offerCents: number;
  previousCents?: number;
  replacesId?: string;
} | null {
  if (!body.startsWith(OFFER_PREFIX)) return null;
  try {
    const value = JSON.parse(body.slice(OFFER_PREFIX.length)) as {
      offerCents?: unknown;
      previousCents?: unknown;
      replacesId?: unknown;
    };
    if (!Number.isSafeInteger(value.offerCents) || Number(value.offerCents) <= 0) return null;
    if (
      value.previousCents !== undefined &&
      (!Number.isSafeInteger(value.previousCents) || Number(value.previousCents) <= 0)
    ) {
      return null;
    }
    if (value.replacesId !== undefined && typeof value.replacesId !== "string") return null;
    return {
      offerCents: Number(value.offerCents),
      ...(value.previousCents === undefined ? {} : { previousCents: Number(value.previousCents) }),
      ...(value.replacesId === undefined ? {} : { replacesId: value.replacesId }),
    };
  } catch {
    return null;
  }
}

function parseOfferResponse(body: string): {
  offerId: string;
  status: "accepted" | "declined";
} | null {
  if (!body.startsWith(OFFER_RESPONSE_PREFIX)) return null;
  try {
    const value = JSON.parse(body.slice(OFFER_RESPONSE_PREFIX.length)) as {
      offerId?: unknown;
      status?: unknown;
    };
    if (typeof value.offerId !== "string" || !value.offerId) return null;
    if (value.status !== "accepted" && value.status !== "declined") return null;
    return { offerId: value.offerId, status: value.status };
  } catch {
    return null;
  }
}

function toMessage(message: ApiMessage, userId: string): ChatMessage {
  const offer = parseOfferMessage(message.body);
  if (offer) {
    return {
      id: message.id,
      mine: message.senderId === userId,
      kind: "offer",
      offerCents: offer.offerCents,
      offerStatus: "pending",
      previousCents: offer.previousCents,
      offerReplacesId: offer.replacesId,
      sentAt: message.createdAt,
    };
  }
  const response = parseOfferResponse(message.body);
  if (response) {
    return {
      id: message.id,
      mine: message.senderId === userId,
      kind: "system",
      body: response.status === "accepted" ? "Offer accepted." : "Offer declined.",
      offerTargetId: response.offerId,
      offerResponseStatus: response.status,
      sentAt: message.createdAt,
    };
  }
  return {
    id: message.id,
    mine: message.senderId === userId,
    kind: message.type === "SYSTEM" ? "system" : "text",
    body: message.body,
    sentAt: message.createdAt,
  };
}

function applyOfferEvents(messages: ChatMessage[]): ChatMessage[] {
  const statuses = new Map<string, OfferStatus>();
  for (const message of messages) {
    if (message.kind === "offer" && message.offerReplacesId) {
      statuses.set(message.offerReplacesId, "countered");
    }
    if (message.offerTargetId && message.offerResponseStatus) {
      statuses.set(message.offerTargetId, message.offerResponseStatus);
    }
  }
  return messages.map((message) => {
    const status = statuses.get(message.id);
    return status ? { ...message, offerStatus: status } : message;
  });
}

function toConversation(thread: ApiThread, messages: ChatMessage[]): Conversation {
  return {
    id: thread.id,
    listingId: thread.listing.id,
    peerId: thread.counterparty.id,
    peerName: thread.counterparty.displayName,
    listingTitle: thread.listing.title,
    listingPriceCents: thread.listing.priceCents,
    unread: 0,
    role: thread.role,
    messages,
  };
}

async function loadThreads() {
  const response = await authenticatedApiRequest<{ success: true; threads: ApiThread[] }>(
    "/threads/my",
    { cache: "no-store" }
  );
  return response.threads;
}

export async function getConversations() {
  const userId = getAuthSession()?.userId ?? "";
  return (await loadThreads()).map((thread) =>
    toConversation(thread, thread.lastMessage ? [toMessage(thread.lastMessage, userId)] : [])
  );
}

export async function getConversation(id: string) {
  let threadId = id;
  if (id.startsWith("l-")) {
    const created = await authenticatedApiRequest<{
      success: true;
      thread: { id: string };
    }>("/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: id.slice(2) }),
    });
    threadId = created.thread.id;
  }

  const thread = (await loadThreads()).find((item) => item.id === threadId);
  if (!thread) return null;

  const response = await authenticatedApiRequest<{
    success: true;
    data: { messages: ApiMessage[] };
  }>(`/threads/${threadId}/messages?limit=50`, { cache: "no-store" });
  const userId = getAuthSession()?.userId ?? "";
  const messages = applyOfferEvents(
    response.data.messages.slice().reverse().map((message) => toMessage(message, userId)),
  );
  return toConversation(thread, messages);
}

export function apiMessageToChat(message: ApiMessage): ChatMessage {
  return toMessage(message, getAuthSession()?.userId ?? "");
}

export type { ApiMessage };
