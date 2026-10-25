"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLanguage } from "@/il8n/LanguageProvider";
import { updateMyListing } from "../actions";
import { getMyListing } from "../queries";
import type { SellerListing } from "../types";

/** Parses birr text ("4500", "4,500.50") to integer cents; NaN when invalid. */
function birrToCents(text: string) {
  const clean = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN;
  const [whole = "0", frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function EditListing({ id }: { id: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [listing, setListing] = useState<SellerListing | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [swap, setSwap] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyListing(id).then((l) => {
      setListing(l);
      if (!l) return;
      setTitle(l.title);
      setDescription(l.description);
      setPrice(String(l.priceCents / 100));
      setNegotiable(l.isNegotiable);
      setSwap(l.acceptsSwap);
    });
  }, [id]);

  if (listing === undefined) {
    return (
      <Container className="max-w-xl space-y-3 px-3 py-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-28 w-full" />
      </Container>
    );
  }
  if (listing === null || listing.status === "sold") {
    return (
      <Container className="max-w-md px-3 py-10">
        <EmptyState
          title={t(listing ? "dashboard.editSoldTitle" : "dashboard.editMissingTitle")}
          body={t(listing ? "dashboard.editSoldBody" : "dashboard.editMissingBody")}
          action={
            <Button onClick={() => router.push("/dashboard/listings")}>{t("dashboard.backToListings")}</Button>
          }
        />
      </Container>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = birrToCents(price);
    const next = {
      title: title.trim() ? undefined : t("dashboard.errTitle"),
      price: Number.isFinite(cents) && cents > 0 ? undefined : t("dashboard.errPrice"),
    };
    setErrors(next);
    if (next.title || next.price) return;
    setSaving(true);
    try {
      await updateMyListing(id, { title, description, priceCents: cents, isNegotiable: negotiable, acceptsSwap: swap });
      router.push("/dashboard/listings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container className="max-w-xl px-3 py-4 sm:py-8">
      <h1 className="mb-4 text-xl font-bold text-ink">{t("dashboard.editTitle")}</h1>
      <form onSubmit={save} className="space-y-4 rounded-card border border-border bg-surface p-4">
        <Input label={t("dashboard.fieldTitle")} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={100} />
        <Input
          label={t("dashboard.fieldPrice")}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          prefix="ETB"
          error={errors.price}
        />
        <label className="block text-sm font-medium text-ink">
          {t("dashboard.fieldDescription")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={2000}
            className="mt-1.5 w-full rounded-control border border-border bg-surface p-3 text-sm font-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="tap-target flex items-center gap-3 text-sm text-ink">
          <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} className="h-5 w-5 accent-primary" />
          {t("common.negotiable")}
        </label>
        <label className="tap-target flex items-center gap-3 text-sm text-ink">
          <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} className="h-5 w-5 accent-primary" />
          {t("common.openToSwap")}
        </label>
        <div className="flex flex-col gap-2 xs:flex-row">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.push("/dashboard/listings")}>
            {t("chat.cancel")}
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {t("dashboard.save")}
          </Button>
        </div>
      </form>
    </Container>
  );
}
