import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the storefront: a full-bleed cover, an overlapping identity card
// (logo + name/meta + action chips), then the product grid.
export default function StoreLoading() {
  return (
    <div className="pb-16">
      <Skeleton className="h-48 w-full rounded-none sm:h-60" />
      <Container>
        <div className="-mt-6 rounded-2xl border border-border bg-surface p-5 shadow-md sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />
              <div className="space-y-2.5">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-28" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-7 w-28 rounded-full" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-24 rounded-xl" />
            </div>
          </div>
        </div>

        <Skeleton className="mb-4 mt-10 h-6 w-32" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
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
      </Container>
    </div>
  );
}
