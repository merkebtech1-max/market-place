"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { StarIcon } from "@/components/ui/Icon";
import { useLanguage } from "@/il8n/LanguageProvider";
import { cn } from "@/lib/utils";

/** Review after a deal (FR-T5): 1–5 stars + optional comment, submitted once. */
export function ReviewSheet({
  open,
  onOpenChange,
  peerName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerName: string;
  onSubmit: (review: { stars: number; comment: string }) => void;
}) {
  const { t } = useLanguage();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (!stars) return setError(true);
    onSubmit({ stars, comment });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      variant="sheet"
      className="md:mx-auto md:mb-[10vh] md:max-w-md md:rounded-card"
      title={t("review.title", { name: peerName })}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {t("review.later")}
          </Button>
          <Button onClick={submit} className="flex-1">
            {t("review.submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label={t("review.rating")} className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={t("review.starLabel", { count: n })}
              onClick={() => {
                setStars(n);
                setError(false);
              }}
              className="tap-target flex items-center justify-center"
            >
              <StarIcon className={cn("h-9 w-9", n <= stars ? "fill-warning text-warning" : "text-border")} />
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-center text-xs font-medium text-danger">
            {t("review.errStars")}
          </p>
        )}
        <label className="block text-sm font-medium text-ink">
          {t("review.comment")}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t("review.commentHint")}
            className="mt-1 w-full rounded-control border border-border bg-surface p-3 text-sm font-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <p className="text-xs text-ink-muted">{t("review.once")}</p>
      </div>
    </Dialog>
  );
}
