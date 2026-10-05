import { authenticatedApiRequest, getAuthSession } from "@/lib/auth";
import type { ChatMessage, Conversation } from "./types";

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

function toMessage(message: ApiMessage, userId: string): ChatMessage {
  return {
    id: message.id,
    mine: message.senderId === userId,
    kind: message.type === "SYSTEM" ? "system" : "text",
    body: message.body,
    sentAt: message.createdAt,
  };
}

function toConversation(thread: ApiThread, messages: ChatMessage[]): Conversation {
  return {
    id: thread.id,
    listingId: thread.listing.id,
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
  const messages = response.data.messages.slice().reverse().map((message) => toMessage(message, userId));
  return toConversation(thread, messages);
}

export function apiMessageToChat(message: ApiMessage): ChatMessage {
  return toMessage(message, getAuthSession()?.userId ?? "");
}

export type { ApiMessage };
