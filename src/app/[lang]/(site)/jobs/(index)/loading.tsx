// Deliberately NOT next to the dynamic [id] route.
//
// A loading.tsx opens a Suspense boundary around its whole segment. Next then
// sends the shell and this skeleton immediately — status 200, headers gone —
// and streams the rest. A notFound() reached afterwards can no longer change
// the status, so an unknown id answered 200 OK with a 404 page in the body.
//
// Measured on production before the fix:
//   /ar/jobs/<unknown-uuid>       200   <- 404 body
//   /ar/wholesale/<unknown-uuid>  200   <- 404 body
//   /ar/product/<unknown-uuid>    200   <- 404 body
//   /ar/u/<unknown-uuid>          404         (no loading.tsx: the control)
//
// Search engines take a 200 as "this page exists" and index the lot. Keeping
// this file inside the (index) group scopes the boundary to the listing page
// that wants it and leaves [id] free to answer honestly.
import { Container } from "@/components/ui/container";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

// Mirrors the jobs board: PageHeader (icon badge + title/subtitle + action),
// two filter-chip rows (type + region), then the 2-up job-card grid.
export default function JobsLoading() {
  return (
    <div className="py-10">
      <Container>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-full" />
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </Container>
    </div>
  );
}
