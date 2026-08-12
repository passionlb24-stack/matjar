import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the account page: identity header, loyalty panel, then the grids of
// shortcut tiles. The heaviest signed-in page — the one place a blank screen
// reads as "logged out".
export default function AccountLoading() {
  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="mt-6 h-36 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </Container>
    </div>
  );
}
