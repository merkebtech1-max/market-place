"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MapPinIcon, ShieldIcon } from "@/components/ui/Icon";
import { useLanguage } from "@/il8n/LanguageProvider";
import { cn } from "@/lib/utils";

/** Suggested public places (FR-T4). Static seed; later served per subcity by the API. */
export const MEETUP_PLACES = ["ednaMall", "police", "bank", "square"] as const;
type Place = (typeof MEETUP_PLACES)[number] | "custom";

export function MeetupSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (proposal: { place: string; when: string }) => void;
}) {
  const { t } = useLanguage();
  const [place, setPlace] = useState<Place | null>(null);
  const [custom, setCustom] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const name = place === "custom" ? custom.trim() : place ? t(`meetup.places.${place}.name`) : "";
    if (!name) return setError(t("meetup.errPlace"));
    if (!when) return setError(t("meetup.errWhen"));
    onSubmit({ place: name, when });
    setPlace(null);
    setCustom("");
    setWhen("");
    setError(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      variant="sheet"
      className="md:mx-auto md:mb-[4vh] md:max-w-md md:rounded-card"
      title={t("meetup.title")}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {t("chat.cancel")}
          </Button>
          <Button onClick={submit} className="flex-1">
            {t("meetup.send")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">{t("meetup.subtitle")}</p>
        <div role="radiogroup" aria-label={t("meetup.title")} className="space-y-2">
          {MEETUP_PLACES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={place === p}
              onClick={() => setPlace(p)}
              className={cn(
                "flex w-full items-center gap-3 rounded-card border p-3 text-left",
                place === p ? "border-primary bg-primary-soft" : "border-border"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                {p === "police" ? <ShieldIcon className="h-5 w-5" /> : <MapPinIcon className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{t(`meetup.places.${p}.name`)}</span>
                <span className="block text-xs text-ink-muted">{t(`meetup.places.${p}.note`)}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={place === "custom"}
            onClick={() => setPlace("custom")}
            className={cn(
              "w-full rounded-card border p-3 text-left text-sm font-medium",
              place === "custom" ? "border-primary bg-primary-soft" : "border-border"
            )}
          >
            {t("meetup.other")}
          </button>
          {place === "custom" && (
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label={t("meetup.other")}
              placeholder={t("meetup.otherHint")}
              className="h-11 w-full rounded-control border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
        </div>
        <label className="block text-sm font-medium text-ink">
          {t("meetup.when")}
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1 h-11 w-full rounded-control border border-border bg-surface px-3 text-sm font-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <p className="text-xs text-ink-muted">{t("meetup.noHome")}</p>
      </div>
    </Dialog>
  );
}
