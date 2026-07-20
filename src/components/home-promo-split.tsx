import Link from "next/link";
import { ArrowLeft, Tags, TrendingUp } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

// Two editorial promo cards side by side: Sunday Market (post an ad) and
// Trending / best-sellers. Breaks up the rhythm of card grids with larger,
// gradient-washed feature tiles.
export function HomePromoSplit({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.home2;
  const cards = [
    {
      href: `/${lang}/market`,
      kicker: t.marketKicker,
      title: t.marketTitle,
      desc: t.marketDesc,
      cta: t.marketCta,
      Icon: Tags,
      wash: "from-accent-soft",
      kickerColor: "text-warning",
    },
    {
      href: `/${lang}/best-sellers`,
      kicker: t.trendKicker,
      title: t.trendTitle,
      desc: t.trendDesc,
      cta: t.trendCta,
      Icon: TrendingUp,
      wash: "from-primary-soft",
      kickerColor: "text-primary",
    },
  ];

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`group relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${c.wash} to-surface p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-8`}
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-surface shadow-sm">
                <c.Icon className={`h-5 w-5 ${c.kickerColor}`} />
              </span>
              <p className={`mt-4 text-xs font-extrabold uppercase tracking-[0.1em] ${c.kickerColor}`}>
                {c.kicker}
              </p>
              <h3 className="mt-1.5 text-2xl font-extrabold tracking-tight">
                {c.title}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {c.desc}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                {c.cta}
                <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1 ltr:rotate-180" />
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
