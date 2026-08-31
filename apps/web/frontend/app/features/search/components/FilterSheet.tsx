"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FilterIcon } from "@/components/ui/Icon";
import { ListingFilters } from "@/features/listings/components/ListingFilters";
import { useTranslations } from "@/il8n/LanguageProvider";
import { useFilterDraft } from "../useFilterDraft";

/** Bottom sheet filter entry point for narrow viewports (SRS §14.2). */
export function FilterSheet() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const { draft, patch, apply, clear, activeCount } = useFilterDraft();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="lg:hidden">
        <FilterIcon className="h-4 w-4" />
        {t("common.filters")}
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        variant="sheet"
        title={t("common.filters")}
        footer={
          <>
            <Button variant="outline" fullWidth onClick={clear}>
              {t("common.clearAll")}
            </Button>
            <Button
              fullWidth
              onClick={() => {
                apply();
                setOpen(false);
              }}
            >
              {t("common.apply")}
            </Button>
          </>
        }
      >
        <ListingFilters value={draft} onChange={patch} />
      </Dialog>
    </>
  );
}
