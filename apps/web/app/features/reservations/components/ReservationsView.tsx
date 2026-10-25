"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PackageIcon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLanguage } from "@/il8n/LanguageProvider";
import { formatETB, listingHref } from "@/lib/utils";
import { ReviewSheet } from "@/features/message/components/ReviewSheet";
import { createRating } from "@/features/reviews/api";
import {
  cancelReservation,
  completeReservation,
  getMyReservations,
  getReservationQr,
  type Reservation,
} from "../api";

export function ReservationsView() {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qr, setQr] = useState<{ reservationId: string; token: string; expiresAt: string } | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [scanToken, setScanToken] = useState("");
  const [completion, setCompletion] = useState("");
  const [ratingReservation, setRatingReservation] = useState<Reservation | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setItems(await getMyReservations());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("reservation.loadError"));
      setItems([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!qr) {
      setQrImage("");
      return;
    }
    void QRCode.toDataURL(qr.token, { width: 280, margin: 2, errorCorrectionLevel: "M" })
      .then(setQrImage)
      .catch(() => setQrImage(""));
  }, [qr]);

  async function showQr(id: string) {
    setBusyId(id);
    setError("");
    try {
      setQr(await getReservationQr(id));
    } catch (qrError) {
      setError(qrError instanceof Error ? qrError.message : t("reservation.qrError"));
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: string) {
    if (!window.confirm(t("reservation.cancelConfirm"))) return;
    setBusyId(id);
    setError("");
    try {
      await cancelReservation(id);
      if (qr?.reservationId === id) setQr(null);
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : t("reservation.cancelError"));
    } finally {
      setBusyId(null);
    }
  }

  async function scan(event: React.FormEvent) {
    event.preventDefault();
    if (!scanToken.trim()) return;
    setError("");
    setCompletion("");
    try {
      const result = await completeReservation(scanToken.trim());
      setCompletion(t("reservation.completed", { id: result.reservationId }));
      setScanToken("");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : t("reservation.scanError"));
    }
  }

  return (
    <Container className="max-w-3xl px-3 py-4 sm:py-8">
      <h1 className="text-xl font-bold text-ink">{t("reservation.title")}</h1>
      <p className="mt-1 text-sm text-ink-muted">{t("reservation.subtitle")}</p>

      {error && <p role="alert" className="mt-4 rounded-control bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {completion && <p role="status" className="mt-4 rounded-control bg-success-soft p-3 text-sm text-ink">{completion}</p>}

      <section className="mt-6" aria-labelledby="buyer-reservations">
        <h2 id="buyer-reservations" className="mb-3 font-semibold text-ink">{t("reservation.mine")}</h2>
        {items === null ? (
          <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<PackageIcon />} title={t("reservation.empty")} />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={listingHref(item.listing.id, item.listing.title)} className="font-semibold text-ink hover:text-primary">
                      {item.listing.title}
                    </Link>
                    <p className="text-sm font-bold text-primary">{formatETB(item.listing.priceCents, locale)}</p>
                    <p className="text-xs text-ink-muted">{item.listing.seller.displayName}</p>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                    {t(`reservation.status.${item.status.toLowerCase()}`)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  {t("reservation.expires", { date: new Date(item.expiresAt).toLocaleString(locale === "am" ? "am-ET" : "en") })}
                </p>
                {item.status === "RESERVED" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => showQr(item.id)} loading={busyId === item.id}>
                      {t("reservation.showQr")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => cancel(item.id)} disabled={busyId === item.id}>
                      {t("reservation.cancel")}
                    </Button>
                  </div>
                )}
                {item.status === "COMPLETED" && !item.hasRated && (
                  <Button className="mt-3" size="sm" onClick={() => setRatingReservation(item)}>
                    {t("reservation.rateSeller")}
                  </Button>
                )}
                {item.hasRated && (
                  <p className="mt-3 text-sm font-medium text-success">{t("reservation.rated")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {qr && (
        <section className="mt-6 rounded-card border border-primary/30 bg-primary-soft/30 p-4">
          <h2 className="font-semibold text-ink">{t("reservation.buyerQr")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("reservation.buyerQrHelp")}</p>
          {qrImage && (
            <img
              src={qrImage}
              alt={t("reservation.buyerQr")}
              width={280}
              height={280}
              className="mx-auto mt-3 rounded-control bg-white p-2"
            />
          )}
          <code className="mt-3 block break-all rounded-control bg-surface p-3 text-xs text-ink">{qr.token}</code>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(qr.token)}>
            {t("reservation.copyToken")}
          </Button>
        </section>
      )}

      <section className="mt-8 rounded-card border border-border bg-surface p-4">
        <h2 className="font-semibold text-ink">{t("reservation.sellerScan")}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t("reservation.sellerScanHelp")}</p>
        <form onSubmit={scan} className="mt-3 space-y-3">
          <textarea
            value={scanToken}
            onChange={(event) => setScanToken(event.target.value)}
            rows={3}
            placeholder={t("reservation.tokenPlaceholder")}
            className="w-full rounded-control border border-border bg-surface p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button type="submit" disabled={!scanToken.trim()}>{t("reservation.complete")}</Button>
        </form>
      </section>

      <ReviewSheet
        key={ratingReservation?.id}
        open={ratingReservation !== null}
        onOpenChange={(open) => !open && setRatingReservation(null)}
        peerName={ratingReservation?.listing.seller.displayName ?? ""}
        onSubmit={async ({ stars, comment }) => {
          if (!ratingReservation) return;
          await createRating(ratingReservation.id, stars, comment);
          setItems((current) =>
            current?.map((item) =>
              item.id === ratingReservation.id ? { ...item, hasRated: true } : item
            ) ?? []
          );
        }}
      />
    </Container>
  );
}
