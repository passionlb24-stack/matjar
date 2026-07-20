import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the merchant OS dashboard: a sector-tinted hero, a KPI row
// (4 stat cards), then the two-column widget area (chart + panel).
export default function MerchantDashboardLoading() {
  return (
    <div className="py-8 sm:py-10">
      <Container className="max-w-5xl">
        <Skeleton className="mt-4 h-40 w-full rounded-3xl" />

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface p-4 shadow-xs"
            >
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="mt-3 h-7 w-24" />
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface p-5 shadow-xs"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-56 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
