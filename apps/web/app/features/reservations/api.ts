import { authenticatedApiRequest } from "@/lib/auth";

export type ReservationStatus = "RESERVED" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "DISPUTED";

export type Reservation = {
  id: string;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  hasRated: boolean;
  listing: {
    id: string;
    title: string;
    priceCents: number;
    condition: string;
    city: { nameEn: string; nameAm: string };
    subcity: { nameEn: string; nameAm: string } | null;
    firstImage: { storageKey: string } | null;
    seller: { id: string; displayName: string };
  };
};

export async function createReservation(listingId: string, threadId: string) {
  const response = await authenticatedApiRequest<{ success: true; data: { id: string } }>(
    "/transactions/reservations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, threadId }),
    }
  );
  return response.data;
}

export async function getMyReservations() {
  const response = await authenticatedApiRequest<{ success: true; data: Reservation[] }>(
    "/transactions/reservations/my",
    { cache: "no-store" }
  );
  return response.data;
}

export async function cancelReservation(id: string) {
  await authenticatedApiRequest(`/transactions/reservations/${id}/cancel`, { method: "POST" });
}

export async function getReservationQr(id: string) {
  const response = await authenticatedApiRequest<{
    success: true;
    data: { reservationId: string; token: string; expiresAt: string };
  }>(`/transactions/reservations/${id}/qr`, { cache: "no-store" });
  return response.data;
}

export async function completeReservation(token: string) {
  const response = await authenticatedApiRequest<{
    success: true;
    data: { reservationId: string; listingId: string; status: string; completedAt: string };
  }>("/transactions/reservations/scan-qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return response.data;
}
