import { authenticatedApiRequest } from "@/lib/auth";
import type { ApiMessage } from "./queries";

export async function sendThreadMessage(threadId: string, body: string) {
  const response = await authenticatedApiRequest<{ success: true; data: ApiMessage }>(
    `/threads/${threadId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }
  );
  return response.data;
}

export async function markThreadRead(threadId: string) {
  await authenticatedApiRequest(`/threads/${threadId}/messages/read`, { method: "PATCH" });
}

export function createReport(input: {
  targetType: "LISTING" | "USER" | "MESSAGE";
  targetId: string;
  reason: string;
  note?: string;
}) {
  return authenticatedApiRequest<{ success: true; data: { id: string } }>("/users/reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getBlockedUsers() {
  const response = await authenticatedApiRequest<{
    success: true;
    data: { id: string; displayName: string; avatarKey: string | null; bio: string | null }[];
  }>("/users/blocked", { cache: "no-store" });
  return response.data;
}

export function blockUser(userId: string) {
  return authenticatedApiRequest<{ success: true }>(`/users/block/${userId}`, { method: "POST" });
}

export function unblockUser(userId: string) {
  return authenticatedApiRequest<{ success: true }>(`/users/block/${userId}`, { method: "DELETE" });
}
