import { Container } from "@/components/ui/container";

// Shared skeleton shown during navigation between public pages so the app
// feels instant instead of blocking on data. A generic card grid covers the
// common case (listing/store/product pages).
export default function Loading() {
  return (
    <div className="py-10">
      <Container>
        <div className="h-8 w-52 animate-pulse rounded-lg bg-surface-muted" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-surface-muted" />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="h-36 w-full animate-pulse bg-surface-muted" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-surface-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
