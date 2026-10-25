import { authenticatedApiRequest } from "@/lib/auth";

export async function createRating(reservationId: string, stars: number, comment: string) {
  const response = await authenticatedApiRequest<{
    success: true;
    data: { id: string; stars: number; comment: string | null };
  }>("/ratings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reservationId,
      stars,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    }),
  });
  return response.data;
}
