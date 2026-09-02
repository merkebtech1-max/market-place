"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { categories, cities } from "@/lib/mock-data";
import { useLanguage, useTranslations } from "@/il8n/LanguageProvider";
import type { SearchFilters } from "../types";

const conditions: SearchFilters["condition"][] = ["new", "like_new", "good", "fair", "for_parts"];

/** Pure filter fields (SRS §3.3 FR-D2), shared by the desktop sidebar and the mobile sheet. */
export function ListingFilters({
  value,
  onChange,
}: {
  value: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
}) {
  const { locale } = useLanguage();
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-5">
      <Select
        label={t("search.category")}
        value={value.category ?? ""}
        onChange={(e) => onChange({ category: e.target.value || undefined })}
      >
        <option value="">{t("search.anyCategory")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {locale === "am" ? c.nameAm : c.nameEn}
          </option>
        ))}
      </Select>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">{t("search.priceRange")}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t("search.min")}
            aria-label={t("search.min")}
            value={value.minPrice ?? ""}
            onChange={(e) => onChange({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
          <span className="text-ink-muted">–</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t("search.max")}
            aria-label={t("search.max")}
            value={value.maxPrice ?? ""}
            onChange={(e) => onChange({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>

      <Select
        label={t("search.condition")}
        value={value.condition ?? ""}
        onChange={(e) => onChange({ condition: (e.target.value || undefined) as SearchFilters["condition"] })}
      >
        <option value="">{t("search.anyCondition")}</option>
        {conditions.map((c) => (
          <option key={c} value={c}>
            {t(`condition.${c}`)}
          </option>
        ))}
      </Select>

      <Select
        label={t("search.location")}
        value={value.city ?? ""}
        onChange={(e) => onChange({ city: e.target.value || undefined })}
      >
        <option value="">{t("search.anyLocation")}</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </Select>

      <Select
        label={t("search.postedWithin")}
        value={value.postedWithin ?? ""}
        onChange={(e) => onChange({ postedWithin: (e.target.value || undefined) as SearchFilters["postedWithin"] })}
      >
        <option value="">{t("search.anyTime")}</option>
        <option value="24h">{t("search.last24h")}</option>
        <option value="7d">{t("search.last7d")}</option>
        <option value="30d">{t("search.last30d")}</option>
      </Select>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="h-4.5 w-4.5 rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-primary"
          checked={Boolean(value.swap)}
          onChange={(e) => onChange({ swap: e.target.checked || undefined })}
        />
        {t("common.openToSwap")}
      </label>
    </div>
  );
}
