import Link from "next/link";
import { Tags, Briefcase, Sparkles, Boxes } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

// "كمان على متجر" — the non-storefront verticals in one compact group.
// They are real destinations with real content, but none of them is what a
// first-time visitor came for, so they get four small tiles rather than four
// competing sections. No descriptions, no counts: the label is the promise.
export function HomeMore({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const items = [
    { href: `/${lang}/market`, label: dict.market.nav, Icon: Tags },
    { href: `/${lang}/jobs`, label: dict.jobs.title, Icon: Briefcase },
    { href: `/${lang}/freelance`, label: dict.freelance.title, Icon: Sparkles },
    { href: `/${lang}/wholesale`, label: dict.wholesale.title, Icon: Boxes },
  ];

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <h2 className="mb-4 text-lg font-extrabold tracking-tight sm:text-xl">
          {dict.homeMore.title}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-primary/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 text-sm font-bold leading-tight transition-colors group-hover:text-primary">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
