"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useLanguage } from "@/il8n/LanguageProvider";
import { cn } from "@/lib/utils";

export const REPORT_REASONS = ["counterfeit", "stolen", "prohibited", "scam", "abuse", "wrongCategory"] as const;
export const REPORT_TARGETS = ["listing", "user", "message"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportTarget = (typeof REPORT_TARGETS)[number];

/** Report flow (FR-S1): target + one of six reasons + optional details. */
export function ReportSheet({
  open,
  onOpenChange,
  defaultTarget = "listing",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTarget?: ReportTarget;
  onSubmit?: (report: { target: ReportTarget; reason: ReportReason; details: string }) => void;
}) {
  const { t } = useLanguage();
  const [target, setTarget] = useState<ReportTarget>(defaultTarget);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setSent(false);
      setReason(null);
      setDetails("");
      setError(false);
    }
  };

  const submit = () => {
    if (!reason) return setError(true);
    onSubmit?.({ target, reason, details });
    setSent(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      variant="sheet"
      className="md:mx-auto md:mb-[6vh] md:max-w-md md:rounded-card"
      title={t("report.title")}
      footer={
        sent ? (
          <Button onClick={() => close(false)} className="flex-1">
            {t("report.done")}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => close(false)} className="flex-1">
              {t("chat.cancel")}
            </Button>
            <Button onClick={submit} className="flex-1">
              {t("report.send")}
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <p role="status" className="py-6 text-center text-sm text-ink">
          {t("report.thanks")}
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{t("report.subtitle")}</p>
          <div role="tablist" className="flex gap-2">
            {REPORT_TARGETS.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={target === k}
                onClick={() => setTarget(k)}
                className={cn(
                  "tap-target rounded-full px-3 text-sm font-medium",
                  target === k ? "bg-primary text-white" : "bg-primary-soft text-primary"
                )}
              >
                {t(`report.target.${k}`)}
              </button>
            ))}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t("report.reason")}</legend>
            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "tap-target flex cursor-pointer items-center gap-3 rounded-control border px-3 text-sm",
                    reason === r ? "border-primary bg-primary-soft" : "border-border"
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => {
                      setReason(r);
                      setError(false);
                    }}
                    className="accent-primary"
                  />
                  {t(`report.reasons.${r}`)}
                </label>
              ))}
            </div>
            {error && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger">
                {t("report.errReason")}
              </p>
            )}
          </fieldset>
          <label className="block text-sm font-medium text-ink">
            {t("report.details")}
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t("report.detailsHint")}
              className="mt-1 w-full rounded-control border border-border bg-surface p-3 text-sm font-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>
      )}
    </Dialog>
  );
}
