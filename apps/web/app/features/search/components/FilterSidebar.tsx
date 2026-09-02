"use client";

import { Button } from "@/components/ui/Button";
import { ListingFilters } from "@/features/listings/components/ListingFilters";
import { useTranslations } from "@/il8n/LanguageProvider";
import { useFilterDraft } from "../useFilterDraft";

/** Always-visible desktop filter panel (SRS §14.2: "sidebar on desktop"). */
export function FilterSidebar() {
  const t = useTranslations();
  const { draft, patch, apply, clear, activeCount } = useFilterDraft();

  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-24 rounded-card border border-border bg-surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{t("common.filters")}</h2>
          {activeCount > 0 && (
            <button type="button" onClick={clear} className="text-xs font-medium text-primary hover:underline">
              {t("common.clearAll")}
            </button>
          )}
        </div>
        <ListingFilters value={draft} onChange={patch} />
        <Button
          type="button"
          onClick={apply}
          fullWidth
          className="mt-5"
        >
          {t("common.apply")}
        </Button>
      </div>
    </aside>
  );
}
