import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the search screen at both readings, because a skeleton that mirrors
// the wrong one is a layout shift with extra steps.
//
// On a phone the screen opens with its own bar — a 44px chevron and a 48px
// field — so the skeleton draws that bar, full-bleed, above the gutter. From
// `lg` up it draws what the results page has always drawn: heading, field,
// count line, then a section label and the grid. Every control is at its real
// height. These are the controls a buyer reaches for while the results are
// still arriving, and neither box may move under their thumb when they do.
export default function SearchLoading() {
  return (
    <div className="pb-16">
      <div className="border-b border-border px-3 py-2 lg:hidden">
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-2xl" />
        </div>
      </div>

      <Container className="py-5 sm:py-8">
        <Skeleton className="hidden h-8 w-64 lg:block" />
        <div className="hidden lg:mt-4 lg:flex lg:items-center lg:gap-2">
          <Skeleton className="h-12 flex-1 rounded-2xl" />
          <Skeleton className="h-12 w-24 rounded-2xl" />
        </div>
        <Skeleton className="h-4 w-32 lg:mt-3" />

        <div className="mt-6 lg:mt-8">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <Skeleton className="h-32 w-full rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
