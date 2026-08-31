"use client";

import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { useTranslations } from "@/il8n/LanguageProvider";

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <circle cx="12" cy="12" r="9" />
      <path d="m14.5 9.5-1.8 5.3a1 1 0 0 1-.6.6L6.8 17.4a.6.6 0 0 1-.76-.76l2-6.3a1 1 0 0 1 .6-.6l4.15-1.6a.6.6 0 0 1 .71.82Z" />
    </svg>
  );
}

export default function NotFound() {
  const t = useTranslations();

  return (
    <Container className="py-16">
      <EmptyState
        icon={<CompassIcon />}
        title={t("states.notFoundTitle")}
        body={t("states.notFoundBody")}
        action={<ButtonLink href="/">{t("nav.home")}</ButtonLink>}
        className="mx-auto max-w-md"
      />
    </Container>
  );
}
