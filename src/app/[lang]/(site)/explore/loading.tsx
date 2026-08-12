import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors explore: title, the filter strip, then the store-card grid — each
// card at the real 3:1 banner ratio so nothing jumps when data lands.
export default function ExploreLoading() {
  return (
    <div className="py-10">
      <Container>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-6 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-xl" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <Skeleton className="aspect-[3/1] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
