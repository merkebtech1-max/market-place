"use client";

import { getReservationPaymentStatus, initializeReservationPayment } from "./api";

/** Opens hosted checkout and resolves only after Merkeb verifies the payment. */
export async function completeReservationCheckout(
  listingId: string,
  threadId: string,
  paymentWindow: Window | null = window.open("about:blank", "_blank"),
) {
  let checkoutOpened = false;

  try {
    if (!paymentWindow) {
      throw new Error("Please allow pop-ups for Merkeb to open the secure payment page.");
    }

    const checkout = await initializeReservationPayment(listingId, threadId);
    paymentWindow.location.href = checkout.checkoutUrl;
    checkoutOpened = true;

    const pollingDeadline = Date.now() + 2 * 60 * 1000;
    while (Date.now() < pollingDeadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      const payment = await getReservationPaymentStatus(checkout.paymentId);

      if (payment.status === "VERIFIED") {
        if (!paymentWindow.closed) paymentWindow.close();
        window.focus();
        return payment;
      }
      if (payment.status === "FAILED" || payment.status === "REFUNDED") {
        throw new Error("The reservation payment was not completed.");
      }
    }

    throw new Error("Payment confirmation is taking longer than expected. Check Reservations shortly.");
  } catch (error) {
    if (paymentWindow && !checkoutOpened) paymentWindow.close();
    throw error;
  }
}
