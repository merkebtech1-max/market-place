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
