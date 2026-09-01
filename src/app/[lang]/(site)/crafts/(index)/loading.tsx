import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the crafts landing so nothing jumps when the real page arrives:
// badge, question, the problem box, one row of problem chips, the panel where
// either the tradesmen or the empty state goes, then the trade groups.
//
// Start-aligned rather than centred, because the page it stands in for is. A
// skeleton whose layout disagrees with the page is a layout shift the user
// experiences as the page breaking and re-forming.
//
// WHY THIS LIVES INSIDE AN `(index)` ROUTE GROUP rather than at `crafts/`.
//
// A `loading.tsx` wraps its own segment AND every route beneath it in a
// Suspense boundary. Sitting at `crafts/`, that boundary also covered
// `[trade]`, `p/[id]` and `requests` — and once a shell has been flushed to the
// client the HTTP status has already been sent, so `notFound()` inside any of
// those could no longer produce a 404. Measured on a production build:
// `/ar/crafts/no-such-trade` and `/ar/crafts/p/not-a-uuid` both answered 200
// with the not-found page in the body. A soft 404, on the 47 pages of this
// section that are meant to rank plus every provider profile.
//
// `(index)` does not appear in the URL, so `/crafts` still resolves to the page
// beside this file — but the boundary now covers the landing page alone, and
// the routes below `crafts/` answer 404 again. Verified both ways against a
// production build.
export default function CraftsLoading() {
  return (
    <div className="py-8 sm:py-10">
      <Container>
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="mt-3 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />

        <Skeleton className="mt-4 h-20 w-full max-w-2xl rounded-2xl" />
        <Skeleton className="mt-2 h-11 w-full max-w-2xl rounded-xl" />

        <div className="mt-5 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-32 shrink-0 rounded-xl" />
          ))}
        </div>

        <Skeleton className="mt-8 h-72 w-full rounded-2xl sm:mt-10" />

        <div className="mt-8 grid grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </Container>
    </div>
  );
}
