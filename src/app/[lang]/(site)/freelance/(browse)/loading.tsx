import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the freelance discovery page: PageHeader (icon badge + title/subtitle
// + action), a chip row, then the card grid.
//
// It lives inside the `(browse)` route group — a group changes no URL — so that
// it covers ONLY /freelance, and not /freelance/[id], /freelance/pro/[id] or
// /freelance/brief. It used to sit at `freelance/loading.tsx`, which meant two
// things, both wrong:
//
//   1. Opening a gig or a profile flashed a grid-of-cards skeleton that looks
//      nothing like the page arriving.
//   2. A `loading.tsx` makes the segment stream, so the response headers are
//      flushed before the page body runs — and a `notFound()` reached after
//      that can no longer set the status. Every unknown gig id answered
//      "200 OK" with a 404 page in the body: the soft 404 that a search engine
//      happily indexes. Measured, not assumed — /ar/u/[id] has no loading.tsx
//      and answers a real 404 for the same input.
//
// Both are fixed by scoping, and the page that had a skeleton still has it.
export default function FreelanceLoading() {
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

        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
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
