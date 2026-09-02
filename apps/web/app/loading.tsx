import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-muted">
      <Spinner size="lg" className="text-primary" />
      <p className="text-sm">Loading…</p>
    </div>
  );
}
