"use client";

import { useEffect } from "react";
import { Container } from "@/components/layout/Container";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTranslations } from "@/il8n/LanguageProvider";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    // Sentry (SRS §15.3) hooks in here once configured; console keeps the
    // failure visible in the meantime.
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16">
      <ErrorState
        title={t("states.errorTitle")}
        body={t("states.errorBody")}
        retryLabel={t("common.retry")}
        onRetry={reset}
        className="mx-auto max-w-md"
      />
    </Container>
  );
}
