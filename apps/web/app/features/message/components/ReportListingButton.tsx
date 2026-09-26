"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/il8n/LanguageProvider";
import { ReportSheet } from "./ReportSheet";

/** Report entry point for the listing detail page (FR-S1). */
export function ReportListingButton() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" fullWidth onClick={() => setOpen(true)}>
        {t("report.listingCta")}
      </Button>
      <ReportSheet open={open} onOpenChange={setOpen} defaultTarget="listing" />
    </>
  );
}
