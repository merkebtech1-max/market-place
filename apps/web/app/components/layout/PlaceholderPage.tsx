import { Container } from "./Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagIcon } from "@/components/ui/Icon";

/**
 * Stand-in for routes outside this pass's scope (SRS §17 work breakdown —
 * auth, messaging, offers, dashboard, admin, etc. are separate build
 * items). Keeps every route in the map (SRS §6) resolvable end to end.
 */
export function PlaceholderPage({ title, body }: { title: string; body?: string }) {
  return (
    <Container className="py-16">
      <EmptyState
        icon={<TagIcon />}
        title={title}
        body={body ?? "This screen is on the build roadmap and isn't implemented yet."}
        className="mx-auto max-w-md"
      />
    </Container>
  );
}
