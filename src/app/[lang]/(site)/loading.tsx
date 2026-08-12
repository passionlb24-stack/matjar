import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// The homepage skeleton, and the fallback for any site page without its own:
// a hero band and a card grid — generic enough to precede most content, shaped
// enough to never be a blank screen.
export default function SiteLoading() {
  return (
    <div className="py-8">
      <Container>
        <Skeleton className="h-56 w-full rounded-3xl sm:h-72" />
        <div className="mt-8 flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <Skeleton className="h-32 w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
