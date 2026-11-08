"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useLanguage } from "@/il8n/LanguageProvider";
import { getConversation } from "@/features/message/queries";
import { completeReservationCheckout } from "@/features/reservations/checkout";
import { getAuthSession } from "@/lib/auth";

export function ListingActions({ listingId, available }: { listingId: string; available: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState("");

  const reserve = async () => {
    if (!getAuthSession()) {
      const next = window.location.pathname;
      router.push(`/sign-in?mode=login&next=${encodeURIComponent(next)}`);
      return;
    }

    const paymentWindow = window.open("about:blank", "_blank");
    if (!paymentWindow) {
      setError("Please allow pop-ups for Merkeb to open the secure payment page.");
      return;
    }

    let checkoutStarted = false;
    setReserving(true);
    setError("");
    try {
      const conversation = await getConversation(`l-${listingId}`);
      if (!conversation) throw new Error("Unable to start a conversation with this seller.");
      checkoutStarted = true;
      await completeReservationCheckout(listingId, conversation.id, paymentWindow);
      router.push("/reservations");
    } catch (cause) {
      if (!checkoutStarted && !paymentWindow.closed) paymentWindow.close();
      setError(cause instanceof Error ? cause.message : t("reservation.createError"));
    } finally {
      setReserving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <Button
          type="button"
          size="lg"
          loading={reserving}
          disabled={!available}
          onClick={reserve}
          className="whitespace-normal px-1.5 text-center text-xs sm:px-3 sm:text-sm"
        >
          <span>{available ? t("listing.reserveItem") : t("badges.reserved")}</span>
        </Button>
        <ButtonLink
          href={`/messages?listing=${listingId}`}
          variant="outline"
          size="lg"
          className="whitespace-normal px-1.5 text-center text-xs sm:px-3 sm:text-sm"
        >
          {t("listing.messageSeller")}
        </ButtonLink>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
