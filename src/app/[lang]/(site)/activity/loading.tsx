import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the activity screen: title, the type-filter rail, then transaction
// rows with their icon block on the leading edge.
export default function ActivityLoading() {
  return (
    <div className="py-6 sm:py-10">
      <Container className="max-w-2xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-4 flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
