import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the crafts landing: hero line, search box, then the trade groups.
export default function CraftsLoading() {
  return (
    <div className="py-10">
      <Container>
        <Skeleton className="mx-auto h-10 w-72" />
        <Skeleton className="mx-auto mt-3 h-4 w-96 max-w-full" />
        <Skeleton className="mx-auto mt-6 h-12 w-full max-w-xl rounded-2xl" />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </Container>
    </div>
  );
}
