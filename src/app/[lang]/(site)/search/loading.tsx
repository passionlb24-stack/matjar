import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the search screen: heading, the field, the count line, then a
// section label and the result grid. The field is drawn at its real 48px
// height — it is the one control on this screen a buyer reaches for while the
// results are still loading, so its box must not move under their thumb.
export default function SearchLoading() {
  return (
    <div className="pb-16">
      <Container className="py-6 sm:py-8">
        <Skeleton className="h-8 w-64" />
        <div className="mt-4 flex items-center gap-2">
          <Skeleton className="h-12 flex-1 rounded-2xl" />
          <Skeleton className="h-12 w-24 rounded-2xl" />
        </div>
        <Skeleton className="mt-3 h-4 w-32" />

        <div className="mt-8">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
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
        </div>
      </Container>
    </div>
  );
}
