import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the orders list: title, then order rows — store line, status pill,
// and a total on the end, the way the real card lays out.
export default function OrdersLoading() {
  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Skeleton className="h-9 w-40" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-3 w-1/2" />
              <div className="mt-3 flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
