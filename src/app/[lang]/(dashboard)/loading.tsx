import { Container } from "@/components/ui/container";

// Skeleton for merchant/admin dashboard navigation — the dashboard was
// previously fully blocking with no loading feedback.
export default function DashboardLoading() {
  return (
    <div className="py-8">
      <Container>
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-muted" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
        <div className="mt-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
      </Container>
    </div>
  );
}
