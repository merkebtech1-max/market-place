"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLanguage } from "@/il8n/LanguageProvider";
import {
  deleteListingImage,
  reorderListingImages,
  uploadListingImage,
} from "@/features/listings/api";
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
  const [photos, setPhotos] = useState<File[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState<string | null>(null);

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
    setSaveError(null);
    try {
      await updateMyListing(id, { title, description, priceCents: cents, isNegotiable: negotiable, acceptsSwap: swap });
      for (const photo of photos) await uploadListingImage(id, photo);
      router.push("/dashboard/listings");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save the listing.");
    } finally {
      setSaving(false);
    }
  };

  const removeImage = async (imageId: string) => {
    if (!listing || listing.images.length <= 1) {
      setSaveError(t("dashboard.cannotRemoveLastPhoto"));
      return;
    }
    if (!window.confirm(t("dashboard.removePhotoConfirm"))) return;
    setImageBusy(imageId);
    setSaveError(null);
    try {
      await deleteListingImage(id, imageId);
      setListing({
        ...listing,
        images: listing.images.filter((image) => image.id !== imageId),
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("dashboard.photoActionError"));
    } finally {
      setImageBusy(null);
    }
  };

  const moveImage = async (index: number, direction: -1 | 1) => {
    if (!listing) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= listing.images.length) return;
    const reordered = [...listing.images];
    const currentImage = reordered[index];
    const adjacentImage = reordered[nextIndex];
    if (!currentImage || !adjacentImage) return;
    reordered[index] = adjacentImage;
    reordered[nextIndex] = currentImage;
    setImageBusy(currentImage.id);
    setSaveError(null);
    try {
      await reorderListingImages(id, reordered.map((image) => image.id));
      setListing({ ...listing, images: reordered });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("dashboard.photoActionError"));
    } finally {
      setImageBusy(null);
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
        {listing.status === "draft" && (
          <section aria-labelledby="listing-photos" className="space-y-3">
            <h2 id="listing-photos" className="text-sm font-medium text-ink">
              {t("dashboard.photos")}
            </h2>
            {listing.images.length > 0 && (
              <ol className="space-y-2">
                {listing.images.map((image, index) => (
                  <li key={image.id} className="flex items-center gap-3 rounded-control border border-border p-2">
                    <Image
                      src={image.url}
                      alt=""
                      width={72}
                      height={72}
                      className="h-16 w-16 shrink-0 rounded-control object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-ink">
                        {index === 0 ? t("dashboard.coverPhoto") : `#${index + 1}`}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={index === 0 || imageBusy !== null}
                          onClick={() => moveImage(index, -1)}
                        >
                          {t("dashboard.moveEarlier")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={index === listing.images.length - 1 || imageBusy !== null}
                          onClick={() => moveImage(index, 1)}
                        >
                          {t("dashboard.moveLater")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={listing.images.length <= 1 || imageBusy !== null}
                          onClick={() => removeImage(image.id)}
                        >
                          {t("dashboard.removePhoto")}
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <label className="block text-sm font-medium text-ink">
              {t("dashboard.addPhoto")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={listing.images.length >= 5}
                onChange={(event) => {
                  const available = 5 - listing.images.length;
                  setPhotos(Array.from(event.target.files ?? []).slice(0, available));
                }}
                className="mt-1.5 block w-full rounded-control border border-border bg-surface p-2 text-sm font-normal file:mr-3 file:rounded-control file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-primary"
              />
              <span className="mt-1 block text-xs font-normal text-ink-muted">
                {t(listing.images.length >= 5 ? "dashboard.photoLimit" : "dashboard.addPhotoHelp")}
              </span>
            </label>
          </section>
        )}
        {saveError && (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            {saveError}
          </p>
        )}
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
