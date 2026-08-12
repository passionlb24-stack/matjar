import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors favorites: title then the store-card grid at the real banner ratio.
export default function FavoritesLoading() {
  return (
    <div className="py-10">
      <Container>
        <Skeleton className="h-9 w-44" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
