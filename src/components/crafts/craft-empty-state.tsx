import Link from "next/link";
import { MessageCircle, PenLine, ShieldCheck, UserPlus } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { buttonVariants } from "@/components/ui/button";
import { ArrowNext } from "@/components/ui/directional-icon";
import { supportWaLink } from "@/lib/support";

// ────────────────────────────────────────────────────────────────────────────
// The screen that actually ships.
//
// craft_providers has zero rows on production. So "no results" is not an edge
// case on this section — it is the state every single visitor sees, on the
// landing page and on all 47 trade pages, and it will stay that way until
// recruitment works. Treating it as an error card with a shrug on it would be
// designing for the version of the marketplace that does not exist.
//
// What it has to do, in order:
//
//   1. Say the true thing first, in one line, without apologising. A customer
//      who is told "لسا ما في حرفي مسجّل" trusts the next sentence. A customer
//      shown an empty grid under a heading that says "حرفيّون" does not.
//   2. Prove the platform is alive rather than broken. The three counters are
//      the honest version of that: the taxonomy and the map are real and
//      finished, and the provider count is shown at whatever it is — including
//      zero. A live young platform and a dead one look identical until you
//      publish the number.
//   3. Route to the two things that genuinely work today. Describing the
//      problem (which we can carry by hand) and recruiting a tradesman. Those
//      are ranked, not offered as equals: the request is the primary action
//      for the person who is already here, and recruitment is second because
//      it is the one that fixes the section.
//
// What it deliberately does NOT do: no "notify me when someone joins" (there
// is no table behind it and it would be a promise nothing keeps), no sample
// providers, no "coming soon" countdown, no greyed-out placeholder cards.
// ────────────────────────────────────────────────────────────────────────────

export type CraftEmptyStateProps = {
  lang: Locale;
  t: Dictionary["crafts"];
  /** Counts, as measured — never rounded up and never hidden when zero. */
  stats: { trades: number; areas: number; providers: number };
  /** Present on a trade page: names the trade in the headline and prefills
   *  both the request flow and the WhatsApp message with it. */
  trade?: { slug: string; name: string } | null;
  /** Present when an area filter is what emptied the page. */
  areaName?: string | null;
  /** Extra query on the request-flow link (a problem phrase, an area slug). */
  askQuery?: Record<string, string>;
  className?: string;
};

export function CraftEmptyState({
  lang,
  t,
  stats,
  trade = null,
  areaName = null,
  askQuery,
  className = "",
}: CraftEmptyStateProps) {
  const headline = trade
    ? areaName
      ? t.emptyHeadlineArea.replace("{trade}", trade.name).replace("{area}", areaName)
      : t.emptyHeadlineTrade.replace("{trade}", trade.name)
    : t.emptyHeadline;

  const params = new URLSearchParams(askQuery ?? {});
  if (trade) params.set("trade", trade.slug);
  const askHref = `/${lang}/crafts/requests${params.toString() ? `?${params}` : ""}`;

  // The WhatsApp fallback carries the trade and the area so the support line
  // knows what is being asked for without a single extra question.
  const waText = trade
    ? areaName
      ? t.waRequestTradeArea.replace("{trade}", trade.name).replace("{area}", areaName)
      : t.waRequestTrade.replace("{trade}", trade.name)
    : t.waRequestGeneric;

  const numbers: { n: number; label: string }[] = [
    { n: stats.trades, label: t.statTrades },
    { n: stats.areas, label: t.statAreas },
    { n: stats.providers, label: t.statProviders },
  ];

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-border bg-surface ${className}`}
    >
      <div className="border-b border-border bg-primary-soft/60 p-5 sm:p-6">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {t.emptyKicker}
        </p>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
          {headline}
        </h2>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          {t.emptyLead
            .replace("{trades}", String(stats.trades))
            .replace("{areas}", String(stats.areas))}
        </p>

        {/* The counters. `dir="ltr"` + tabular-nums so an Arabic page still
            reads "47" as forty-seven and the three columns line up. */}
        <ul className="mt-4 grid grid-cols-3 gap-2">
          {numbers.map((s) => (
            <li
              key={s.label}
              className="min-w-0 rounded-xl border border-border bg-surface px-2 py-2.5 text-center"
            >
              <span
                dir="ltr"
                className="block text-lg font-extrabold tabular-nums text-foreground"
              >
                {s.n}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-5 sm:p-6">
        <h3 className="text-sm font-extrabold text-muted-foreground">
          {t.emptyWorksTitle}
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {/* 1 — the request. Primary, because the person reading this came
              here with a broken washing machine, not with a business plan. */}
          <div className="min-w-0 rounded-xl border border-border p-4">
            <p className="flex items-center gap-2 font-bold">
              <PenLine aria-hidden className="h-4 w-4 shrink-0 text-primary" />
              {t.emptyWork1Title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t.emptyWork1Body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={askHref}
                className={buttonVariants({ variant: "primary" })}
              >
                {t.emptyPrimary}
                <ArrowNext className="h-4 w-4" />
              </Link>
              <a
                href={supportWaLink(waText)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "whatsapp" })}
              >
                <MessageCircle aria-hidden className="h-4 w-4" />
                {t.requestHelpCta}
              </a>
            </div>
          </div>

          {/* 2 — recruitment. Second on the page, first in importance to the
              section: supply is the bottleneck and demand is not. */}
          <div className="min-w-0 rounded-xl border border-border p-4">
            <p className="flex items-center gap-2 font-bold">
              <UserPlus aria-hidden className="h-4 w-4 shrink-0 text-primary" />
              {t.emptyWork2Title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t.emptyWork2Body}</p>
            <div className="mt-3">
              <Link
                href={`/${lang}/crafts/join`}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t.emptyRecruitCta}
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {t.emptyNoFake}
        </p>
      </div>
    </section>
  );
}
