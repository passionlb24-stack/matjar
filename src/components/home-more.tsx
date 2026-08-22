import Link from "next/link";
import { Tags, Briefcase, Sparkles, Boxes } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import type { NavSections } from "@/lib/data/section-supply";

// "كمان على متجر" — the non-storefront verticals in one compact group.
// They are real destinations with real content, but none of them is what a
// first-time visitor came for, so they get four small tiles rather than four
// competing sections. No descriptions, no counts: the label is the promise.
//
// And the promise is now checked. A tile whose section cannot return three real
// results is dropped, on the same count and the same threshold as the rails
// above it (MP-026) — "the label is the promise" only holds while the section
// can keep it. With nothing left to show, the whole block goes, heading
// included.
export function HomeMore({
  lang,
  dict,
  sections,
}: {
  lang: Locale;
  dict: Dictionary;
  sections: NavSections;
}) {
  const items = [
    { href: `/${lang}/market`, label: dict.market.nav, Icon: Tags, on: sections.market },
    { href: `/${lang}/jobs`, label: dict.jobs.title, Icon: Briefcase, on: sections.jobs },
    { href: `/${lang}/freelance`, label: dict.freelance.title, Icon: Sparkles, on: sections.freelance },
    { href: `/${lang}/wholesale`, label: dict.wholesale.title, Icon: Boxes, on: sections.wholesale },
  ].filter((i) => i.on);

  if (items.length === 0) return null;

  return (
    <section className="py-5 sm:py-8 lg:py-12">
      <Container>
        <h2 className="mb-3 text-lg font-extrabold tracking-tight sm:mb-4 sm:text-xl">
          {dict.homeMore.title}
        </h2>
        {/* Two-up on a phone is two rows of 56px tiles for what is, by this
            block's own argument, not what anybody came for. Below `sm` it is
            one scrolling row of 44px pills — still four real destinations, at a
            third of the height. The `sm` grid is untouched. */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-border bg-surface px-3 transition-colors hover:border-primary/40 sm:h-auto sm:min-h-14 sm:gap-3 sm:p-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary sm:h-10 sm:w-10 sm:rounded-xl">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="min-w-0 whitespace-nowrap text-sm font-bold leading-tight transition-colors group-hover:text-primary sm:whitespace-normal">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
