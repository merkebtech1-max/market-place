import { Container } from "@/components/layout/Container";
import { T } from "@/il8n/T";

const TOPICS = ["safety", "offers", "report"] as const;

/** Smallest useful support page: help topics that point at features that exist today. */
export default function SupportPage() {
  return (
    <Container className="max-w-2xl px-3 py-6 sm:py-10">
      <h1 className="mb-1 text-xl font-bold text-ink">
        <T k="support.title" />
      </h1>
      <p className="mb-4 text-sm text-ink-muted">
        <T k="support.subtitle" />
      </p>
      <ul className="space-y-3">
        {TOPICS.map((k) => (
          <li key={k} className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">
              <T k={`support.topics.${k}.title`} />
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              <T k={`support.topics.${k}.body`} />
            </p>
          </li>
        ))}
      </ul>
    </Container>
  );
}
