"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CameraIcon, CheckIcon, ChevronLeftIcon, MapPinIcon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { ListingCondition } from "@/features/listings/types";
import {
  createListingDraft,
  getCategories,
  getLocationTree,
  publishListing,
  updateListingDraft,
  uploadListingImage,
} from "@/features/listings/api";
import { useLanguage, useTranslations } from "@/il8n/LanguageProvider";
import {
  getIsAuthenticated,
  getServerIsAuthenticated,
  subscribeAuthSession,
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Category } from "@/features/catalog/types";

type SellStep = "category" | "details" | "pricing" | "review";

const STEPS: SellStep[] = ["category", "details", "pricing", "review"];
const CONDITIONS: ListingCondition[] = ["new", "like_new", "good", "fair", "for_parts"];
const SELL_DRAFT_STORAGE_KEY = "merkeb.sell-draft";
const SELL_SUBMISSION_STORAGE_KEY = "merkeb.sell-submission";

type SellDraft = {
  categoryId: string;
  title: string;
  description: string;
  photoPreview: string | null;
  priceEtb: string;
  isNegotiable: boolean;
  acceptsSwap: boolean;
  condition: ListingCondition | "";
  city: string;
  subcity: string;
  landmark: string;
};

const emptyDraft: SellDraft = {
  categoryId: "",
  title: "",
  description: "",
  photoPreview: null,
  priceEtb: "",
  isNegotiable: true,
  acceptsSwap: false,
  condition: "",
  city: "",
  subcity: "",
  landmark: "",
};

function stepIndex(step: SellStep) {
  return STEPS.indexOf(step);
}

export function SellFlow() {
  const t = useTranslations();
  const { locale } = useLanguage();
  const isAuthenticated = useSyncExternalStore(
    subscribeAuthSession,
    getIsAuthenticated,
    getServerIsAuthenticated
  );
  const router = useRouter();

  const [step, setStep] = useState<SellStep>("category");
  const [draft, setDraft] = useState<SellDraft>(emptyDraft);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [draftListingId, setDraftListingId] = useState<string | null>(null);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Awaited<ReturnType<typeof getLocationTree>>>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof SellDraft, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [published, setPublished] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SELL_DRAFT_STORAGE_KEY);
      if (stored) {
        const saved = JSON.parse(stored) as { draft?: SellDraft; step?: SellStep };
        if (saved.draft) setDraft({ ...emptyDraft, ...saved.draft, photoPreview: null });
        if (saved.step && STEPS.includes(saved.step)) setStep(saved.step);
        window.sessionStorage.removeItem(SELL_DRAFT_STORAGE_KEY);
      }
      const submission = window.sessionStorage.getItem(SELL_SUBMISSION_STORAGE_KEY);
      if (submission) {
        const parsed = JSON.parse(submission) as { listingId?: string; imageUploaded?: boolean };
        setDraftListingId(parsed.listingId ?? null);
        setImageUploaded(parsed.imageUploaded === true);
      }
    } catch {
      window.sessionStorage.removeItem(SELL_DRAFT_STORAGE_KEY);
      window.sessionStorage.removeItem(SELL_SUBMISSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    void Promise.all([getCategories(), getLocationTree()]).then(([nextCategories, nextLocations]) => {
      setAvailableCategories(nextCategories);
      setLocations(nextLocations);
    });
  }, []);

  const selectedCategory = useMemo(
    () => availableCategories.find((c) => c.id === draft.categoryId) ?? null,
    [availableCategories, draft.categoryId]
  );

  const selectedCity = locations.find((location) => location.id === draft.city) ?? null;
  const selectedSubcity = selectedCity?.children?.find((location) => location.id === draft.subcity) ?? null;
  const subcities = selectedCity?.children ?? [];

  function patch(next: Partial<SellDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function validate(current: SellStep): boolean {
    const nextErrors: Partial<Record<keyof SellDraft, string>> = {};

    if (current === "category" && !draft.categoryId) {
      nextErrors.categoryId = t("sell.errors.category");
    }

    if (current === "details") {
      if (draft.title.trim().length < 4) nextErrors.title = t("sell.errors.title");
      if (draft.description.trim().length < 20) nextErrors.description = t("sell.errors.description");
      if (!photoFile && !draft.photoPreview) nextErrors.photoPreview = "Add at least one photo.";
    }

    if (current === "pricing") {
      const price = Number(draft.priceEtb);
      if (!draft.priceEtb || Number.isNaN(price) || price < 0) {
        nextErrors.priceEtb = t("sell.errors.price");
      }
      if (!draft.condition) nextErrors.condition = t("sell.errors.condition");
      if (!draft.city) nextErrors.city = t("sell.errors.city");
      if (!draft.subcity) nextErrors.subcity = t("sell.errors.subcity");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goNext() {
    if (!validate(step)) return;
    const idx = stepIndex(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!);
  }

  function goBack() {
    setErrors({});
    const idx = stepIndex(step);
    if (idx > 0) setStep(STEPS[idx - 1]!);
  }

  function handlePhotoChange(file: File | null) {
    setPhotoFile(file);
    setImageUploaded(false);
    if (!file) {
      patch({ photoPreview: null });
      return;
    }
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    patch({ photoPreview: url });
  }

  async function handlePublish(e: FormEvent) {
    e.preventDefault();
    if (!validate("pricing") || !validate("details") || !validate("category")) {
      setStep("category");
      return;
    }
    if (!isAuthenticated) {
      window.sessionStorage.setItem(
        SELL_DRAFT_STORAGE_KEY,
        JSON.stringify({ draft: { ...draft, photoPreview: null }, step })
      );
      router.push("/sign-in?mode=login&next=%2Fsell");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const input = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        condition: draft.condition.toUpperCase(),
        priceCents: Math.round(Number(draft.priceEtb) * 100),
        isNegotiable: draft.isNegotiable,
        attributes: { acceptsSwap: draft.acceptsSwap },
        categoryId: draft.categoryId,
        cityId: draft.city,
        ...(draft.subcity ? { subcityId: draft.subcity } : {}),
        ...(draft.landmark.trim() ? { landmark: draft.landmark.trim() } : {}),
      };
      let listingId = draftListingId;
      if (listingId) {
        await updateListingDraft(listingId, input);
      } else {
        const created = await createListingDraft(input);
        listingId = created.listingId;
        setDraftListingId(listingId);
        window.sessionStorage.setItem(
          SELL_SUBMISSION_STORAGE_KEY,
          JSON.stringify({ listingId, imageUploaded: false })
        );
      }
      if (!imageUploaded && photoFile) {
        await uploadListingImage(listingId, photoFile);
        setImageUploaded(true);
        window.sessionStorage.setItem(
          SELL_SUBMISSION_STORAGE_KEY,
          JSON.stringify({ listingId, imageUploaded: true })
        );
      }
      await publishListing(listingId);
      window.sessionStorage.removeItem(SELL_DRAFT_STORAGE_KEY);
      window.sessionStorage.removeItem(SELL_SUBMISSION_STORAGE_KEY);
      setPublished(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to publish the listing.");
    } finally {
      setSubmitting(false);
    }
  }

  if (published) {
    return (
      <div className="mx-auto max-w-lg rounded-card border border-border bg-surface p-6 text-center shadow-elevation-1 sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink">{t("sell.successTitle")}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("sell.successBody")}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={() => router.push("/home")}>
            {t("sell.backHome")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(emptyDraft);
              setPhotoFile(null);
              setDraftListingId(null);
              setImageUploaded(false);
              setStep("category");
              setPublished(false);
              setErrors({});
            }}
          >
            {t("sell.listAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 space-y-3">
        <p className="text-sm font-medium text-primary">{t("sell.eyebrow")}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("sell.title")}</h1>
        <p className="max-w-xl text-sm text-ink-muted">{t("sell.subtitle")}</p>
        <StepProgress step={step} />
      </header>

      <form onSubmit={handlePublish} className="space-y-6">
        {step === "category" && (
          <section className="space-y-4" aria-labelledby="sell-category-heading">
            <div>
              <h2 id="sell-category-heading" className="text-base font-semibold text-ink">
                {t("sell.categoryTitle")}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{t("sell.categoryBody")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {availableCategories.map((cat) => {
                const selected = draft.categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      patch({ categoryId: cat.id });
                      setErrors((e) => ({ ...e, categoryId: undefined }));
                    }}
                    className={cn(
                      "group relative overflow-hidden rounded-card border text-left transition-all",
                      selected
                        ? "border-primary ring-2 ring-primary/25 shadow-elevation-1"
                        : "border-border hover:border-primary/40 hover:shadow-elevation-1"
                    )}
                  >
                    <div className="relative aspect-[4/3] bg-primary-soft/40">
                      <Image
                        src={cat.imageUrl}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 50vw, 200px"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                          <CheckIcon className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="px-2.5 py-2.5">
                      <p className="text-sm font-semibold text-ink">
                        {locale === "am" ? cat.nameAm : cat.nameEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.categoryId && (
              <p role="alert" className="text-xs font-medium text-danger">
                {errors.categoryId}
              </p>
            )}
          </section>
        )}

        {step === "details" && (
          <section className="space-y-5" aria-labelledby="sell-details-heading">
            <div>
              <h2 id="sell-details-heading" className="text-base font-semibold text-ink">
                {t("sell.detailsTitle")}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{t("sell.detailsBody")}</p>
              {selectedCategory && (
                <p className="mt-2 text-xs font-medium text-primary">
                  {locale === "am" ? selectedCategory.nameAm : selectedCategory.nameEn}
                </p>
              )}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{t("sell.photos")}</span>
              <span
                className={cn(
                  "relative flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-card border border-dashed border-border bg-surface px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary-soft/20",
                  draft.photoPreview && "border-solid p-0"
                )}
              >
                {draft.photoPreview ? (
                  <Image
                    src={draft.photoPreview}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <CameraIcon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-medium text-ink">{t("sell.photosCta")}</span>
                    <span className="text-xs text-ink-muted">{t("sell.photosHint")}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
                />
              </span>
            </label>
            {errors.photoPreview && (
              <p role="alert" className="text-xs font-medium text-danger">
                {errors.photoPreview}
              </p>
            )}

            <Input
              label={t("sell.itemTitle")}
              name="title"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={t("sell.itemTitlePlaceholder")}
              error={errors.title}
              maxLength={80}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sell-description" className="text-sm font-medium text-ink">
                {t("sell.description")}
              </label>
              <textarea
                id="sell-description"
                name="description"
                rows={5}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder={t("sell.descriptionPlaceholder")}
                className={cn(
                  "w-full rounded-control border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                  errors.description ? "border-danger" : "border-border"
                )}
              />
              {errors.description ? (
                <p role="alert" className="text-xs font-medium text-danger">
                  {errors.description}
                </p>
              ) : (
                <p className="text-xs text-ink-muted">{t("sell.descriptionHint")}</p>
              )}
            </div>
          </section>
        )}

        {step === "pricing" && (
          <section className="space-y-5" aria-labelledby="sell-pricing-heading">
            <div>
              <h2 id="sell-pricing-heading" className="text-base font-semibold text-ink">
                {t("sell.pricingTitle")}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{t("sell.pricingBody")}</p>
            </div>

            <Input
              label={t("sell.price")}
              name="price"
              type="number"
              inputMode="numeric"
              min={0}
              prefix="ETB"
              value={draft.priceEtb}
              onChange={(e) => patch({ priceEtb: e.target.value })}
              placeholder="0"
              error={errors.priceEtb}
              required
            />

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={draft.isNegotiable}
                  onChange={(e) => patch({ isNegotiable: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                {t("common.negotiable")}
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={draft.acceptsSwap}
                  onChange={(e) => patch({ acceptsSwap: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                {t("common.openToSwap")}
              </label>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">{t("sell.condition")}</legend>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => {
                  const selected = draft.condition === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        patch({ condition: c });
                        setErrors((e) => ({ ...e, condition: undefined }));
                      }}
                      className={cn(
                        "rounded-control border px-3 py-2 text-sm font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-surface text-ink hover:border-primary/40"
                      )}
                    >
                      {t(`condition.${c}`)}
                    </button>
                  );
                })}
              </div>
              {errors.condition && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                  {errors.condition}
                </p>
              )}
            </fieldset>

            <div className="space-y-4 rounded-card border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <MapPinIcon className="h-4 w-4 text-primary" />
                {t("sell.locationTitle")}
              </div>

              <Select
                label={t("sell.city")}
                value={draft.city}
                onChange={(e) => {
                  const city = e.target.value;
                  patch({ city, subcity: "" });
                }}
              >
                <option value="">{t("sell.cityPlaceholder")}</option>
                {locations.map((city) => (
                  <option key={city.id} value={city.id}>
                    {locale === "am" ? city.nameAm : city.nameEn}
                  </option>
                ))}
              </Select>
              {errors.city && (
                <p role="alert" className="text-xs font-medium text-danger">
                  {errors.city}
                </p>
              )}

              <Select
                label={t("sell.subcity")}
                value={draft.subcity}
                disabled={!draft.city}
                onChange={(e) => patch({ subcity: e.target.value })}
              >
                <option value="">{t("sell.subcityPlaceholder")}</option>
                {subcities.map((s) => (
                  <option key={s.id} value={s.id}>
                    {locale === "am" ? s.nameAm : s.nameEn}
                  </option>
                ))}
              </Select>
              {errors.subcity && (
                <p role="alert" className="text-xs font-medium text-danger">
                  {errors.subcity}
                </p>
              )}

              <Input
                label={t("sell.landmark")}
                name="landmark"
                value={draft.landmark}
                onChange={(e) => patch({ landmark: e.target.value })}
                placeholder={t("sell.landmarkPlaceholder")}
                hint={t("sell.landmarkHint")}
              />
            </div>
          </section>
        )}

        {step === "review" && (
          <section className="space-y-4" aria-labelledby="sell-review-heading">
            <div>
              <h2 id="sell-review-heading" className="text-base font-semibold text-ink">
                {t("sell.reviewTitle")}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{t("sell.reviewBody")}</p>
            </div>

            <div className="overflow-hidden rounded-card border border-border bg-surface shadow-elevation-1">
              <div className="relative aspect-[16/10] bg-primary-soft/30">
                {draft.photoPreview ? (
                  <Image
                    src={draft.photoPreview}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                    {t("sell.noPhoto")}
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {selectedCategory
                      ? locale === "am"
                        ? selectedCategory.nameAm
                        : selectedCategory.nameEn
                      : "—"}
                  </p>
                  <h3 className="mt-0.5 text-lg font-semibold text-ink">{draft.title}</h3>
                </div>
                <p className="text-xl font-bold text-primary">
                  ETB {Number(draft.priceEtb || 0).toLocaleString("en-ET")}
                  {draft.isNegotiable && (
                    <span className="ml-2 text-sm font-normal text-ink-muted">
                      · {t("common.negotiable")}
                    </span>
                  )}
                </p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ink-muted">{t("sell.condition")}</dt>
                    <dd className="font-medium text-ink">
                      {draft.condition ? t(`condition.${draft.condition}`) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">{t("listing.location")}</dt>
                    <dd className="font-medium text-ink">
                      {[selectedSubcity?.nameEn, selectedCity?.nameEn].filter(Boolean).join(", ") || "—"}
                    </dd>
                  </div>
                </dl>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                  {draft.description}
                </p>
              </div>
            </div>

            {!isAuthenticated && (
              <p className="rounded-control border border-warning/30 bg-warning-soft/50 px-3 py-2 text-sm text-ink">
                {t("sell.signInRequired")}
              </p>
            )}
          </section>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-border pt-4">
          {submitError && <p role="alert" className="text-sm text-danger">{submitError}</p>}
          {stepIndex(step) > 0 ? (
            <Button type="button" variant="ghost" onClick={goBack}>
              <ChevronLeftIcon className="h-4 w-4" />
              {t("common.back")}
            </Button>
          ) : (
            <span />
          )}

          {step === "review" ? (
            <Button type="submit" size="lg" loading={submitting}>
              {t("sell.publish")}
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={goNext}>
              {t("sell.continue")}
            </Button>
          )}
        </footer>
      </form>
    </div>
  );
}

function StepProgress({ step }: { step: SellStep }) {
  const t = useTranslations();
  const labels: Record<SellStep, string> = {
    category: t("sell.stepCategory"),
    details: t("sell.stepDetails"),
    pricing: t("sell.stepPricing"),
    review: t("sell.stepReview"),
  };
  const current = stepIndex(step);

  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label={t("sell.stepsLabel")}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done || active ? "bg-primary text-white" : "bg-ink/8 text-ink-muted"
              )}
            >
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden truncate text-xs font-medium sm:inline",
                active ? "text-ink" : "text-ink-muted"
              )}
            >
              {labels[s]}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={cn("mx-0.5 h-px flex-1", done ? "bg-primary" : "bg-border")}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
