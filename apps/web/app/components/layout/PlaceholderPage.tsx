import type { ReactNode } from "react";
import { Container } from "./Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagIcon } from "@/components/ui/Icon";
import { T } from "@/il8n/T";

/**
 * Stand-in for routes outside this pass's scope (SRS §17 work breakdown —
 * auth, messaging, offers, dashboard, admin, etc. are separate build
 * items). Keeps every route in the map (SRS §6) resolvable end to end.
 */
export function PlaceholderPage({ title, body }: { title: ReactNode; body?: ReactNode }) {
  return (
    <Container className="px-3 py-10 sm:py-16">
      <EmptyState
        icon={<TagIcon />}
        title={title}
        body={body ?? <T k="placeholder.comingSoon" />}
        className="mx-auto max-w-md"
      />
    </Container>
  );
}
