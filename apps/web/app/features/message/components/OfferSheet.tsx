"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/il8n/LanguageProvider";
import { formatETB } from "@/lib/utils";

/** Parses whole/decimal birr text to integer cents (SRS: money is integer ETB cents). */
function toCents(text: string) {
  const clean = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN;
  const [whole = "0", frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function OfferSheet({
  open,
  onOpenChange,
  mode,
  listPriceCents,
  lastOfferCents,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "offer" | "counter";
  listPriceCents: number;
  /** The offer being countered, shown for context. */
  lastOfferCents?: number;
  onSubmit: (cents: number) => void;
}) {
  const { t, locale } = useLanguage();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const cents = toCents(value);
    if (!Number.isFinite(cents) || cents <= 0) return setError(t("chat.offerSheet.errInvalid"));
    if (mode === "offer" && cents > listPriceCents) return setError(t("chat.offerSheet.errTooHigh"));
    setError(undefined);
    setValue("");
    onSubmit(cents);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      variant="sheet"
      className="md:mx-auto md:mb-[10vh] md:max-w-md md:rounded-card"
      title={t(mode === "offer" ? "chat.offerSheet.titleOffer" : "chat.offerSheet.titleCounter")}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {t("chat.cancel")}
          </Button>
          <Button onClick={submit} className="flex-1">
            {t(mode === "offer" ? "chat.offerSheet.sendOffer" : "chat.offerSheet.sendCounter")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <dl className="flex justify-between text-sm">
          <dt className="text-ink-muted">{t("chat.offerSheet.listPrice")}</dt>
          <dd className="font-semibold text-ink">{formatETB(listPriceCents, locale)}</dd>
        </dl>
        {lastOfferCents !== undefined && (
          <dl className="flex justify-between text-sm">
            <dt className="text-ink-muted">{t("chat.offerSheet.theirOffer")}</dt>
            <dd className="font-semibold text-ink">{formatETB(lastOfferCents, locale)}</dd>
          </dl>
        )}
        <Input
          label={t("chat.offerSheet.amount")}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          prefix={locale === "am" ? "ብር" : "ETB"}
          error={error}
          autoComplete="off"
        />
        <p className="rounded-control bg-primary-soft px-3 py-2 text-xs text-ink">{t("chat.noPayment")}</p>
      </div>
    </Dialog>
  );
}
