import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the search results page: heading + count, a section label, then
// the product-result grid.
export default function SearchLoading() {
  return (
    <div className="py-10">
      <Container>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-1 h-4 w-32" />

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
