import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the product page: breadcrumb, a 2-col gallery/details split
// (large square image + title/price/desc/button), then a related grid.
export default function ProductLoading() {
  return (
    <div className="py-8">
      <Container>
        <Skeleton className="h-4 w-56" />

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />

          <div className="space-y-4">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-8 w-32" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl sm:w-56" />
          </div>
        </div>

        <div className="mt-12">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <Skeleton className="h-36 w-full rounded-none" />
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
