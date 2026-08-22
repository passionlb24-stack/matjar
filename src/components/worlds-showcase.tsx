import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { groupKeys } from "@/lib/catalog";
import { groupIcons } from "@/components/category-icon";
import { Container } from "@/components/ui/container";
import { ChevronNext } from "@/components/ui/directional-icon";

// Categories — the scannable navigation layer above the 17 granular sectors.
// V2 drops the per-card description: this row exists to be scanned in one
// pass, and a two-line blurb under every tile turns nine choices into a wall
// of reading. Each tile links into /explore filtered by group.
const TINTS = [
  "bg-primary-soft text-primary",
  "bg-accent-soft text-warning",
  "bg-success-soft text-success",
];

export function WorldsShowcase({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <section className="py-5 sm:py-8 lg:py-12">
      <Container>
        <div className="mb-3 flex items-center justify-between gap-4 sm:mb-5 sm:items-end">
          <h2 className="text-lg font-extrabold tracking-tight sm:text-2xl lg:text-3xl">
            {dict.categories.title}
          </h2>
          <Link
            href={`/${lang}/categories`}
            // -me-2/px-2 keeps the label optically flush with the container
            // edge. The box is 28px tall on a phone so the heading row does not
            // cost 44 — the tap target is grown back to 44 by the transparent
            // ::before, the same pattern the header logo uses. At `sm` it goes
            // back to an intrinsic h-11.
            className="relative -me-2 inline-flex shrink-0 items-center gap-1 px-2 py-1 text-sm font-bold text-primary transition-colors before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:text-primary-hover sm:h-11 sm:py-0 sm:before:hidden"
          >
            {dict.home2.seeAll}
            <ChevronNext className="h-4 w-4" />
          </Link>
        </div>

        {/* Nine categories stacked two-up is five rows — a whole phone screen
            of navigation before a single store appears. Below `lg` it is one
            snap-scrolling row that bleeds past the Container gutter, so the
            clipped card is what says "keep going". At `lg` every rail class
            unwinds into a plain three-column grid. */}
        <div
          data-animate
          className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-3 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {groupKeys.map((g, i) => {
            const Icon = groupIcons[g];
            return (
              <Link
                key={g}
                href={`/${lang}/explore?group=${g}`}
                className="group flex min-h-14 w-40 shrink-0 snap-start items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-primary/40 lg:w-auto lg:p-4"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TINTS[i % TINTS.length]}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 text-sm font-bold leading-tight transition-colors group-hover:text-primary">
                  {dict.groups[g].name}
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
