import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronDown, MessageCircle, Wrench } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { CraftCard } from "@/components/crafts/craft-card";
import { CraftsSearch } from "@/components/crafts/crafts-search";
import { groupIcon, tradeIcon } from "@/lib/trade-icons";
import { supportWaLink } from "@/lib/support";
import {
  browseCrafts,
  getAreasByRegion,
  getTradeCounts,
  getTradeGroups,
} from "@/lib/data/crafts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.crafts.title, description: dict.crafts.subtitle };
}

// Editorial quick links: the jobs Lebanese households actually call about,
// in the order they call about them. Not "الأكثر طلبًا" — there is no request
// volume to rank by yet, and a ranking backed by nothing is a lie. These are
// resolved against the live taxonomy at render time, so a renamed or retired
// slug silently drops out instead of 404ing.
const QUICK_TRADE_SLUGS = [
  "electrician",
  "plumber",
  "ac-service",
  "washer-repair",
  "painter",
  "furniture-moving",
  "solar",
  "home-cleaning",
];

// The crafts directory.
//
// There are no providers yet, and the page is honest about that instead of
// dressing an empty marketplace as a full one. The conversion path at zero
// supply is: understand the problem (search + quick links), capture it as a
// request (WhatsApp, since a stored request requires a provider to address),
// and recruit tradesmen with that demand (the join CTA at the bottom carries
// more weight here than usual — supply is the bottleneck).
//
// Provider sections render only from data. The day browse_crafts returns rows,
// the cards appear; until then nothing pretends.
export default async function CraftsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.crafts;
  const ar = lang === "ar";

  const [groups, counts, areasByRegion, featured] = await Promise.all([
    getTradeGroups(),
    getTradeCounts(),
    getAreasByRegion(),
    browseCrafts({ limit: 8 }),
  ]);

  const allTrades = groups.flatMap((g) => g.trades);
  const quick = QUICK_TRADE_SLUGS.map((slug) =>
    allTrades.find((tr) => tr.slug === slug),
  ).filter((tr) => tr !== undefined);

  return (
    <div className="py-8 sm:py-10">
      <Container>
        {/* Hero: small badge, the question, one supporting line. The search is
            the hero — everything above it stays short enough that on a phone
            the input and quick links share the first viewport. */}
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
            <Wrench className="h-3.5 w-3.5" />
            {t.badge}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t.heroTitle}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
            {t.heroSubtitle}
          </p>
        </div>

        <div className="mt-5">
          <CraftsSearch
            lang={lang}
            areasByRegion={areasByRegion}
            labels={{
              whatPlaceholder: t.whatPlaceholder,
              wherePlaceholder: t.wherePlaceholder,
              anywhere: t.anywhere,
              search: t.search,
              noMatch: t.noTradeMatch,
            }}
          />
        </div>

        {/* Quick links — one scrollable row on mobile, wrapping on desktop.
            Labelled as editorial picks, not as measured demand. */}
        {quick.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground">
              {t.quickTitle}
            </p>
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {quick.map((tr) => {
                const Icon = tradeIcon(tr.slug, tr.group_slug);
                return (
                  <Link
                    key={tr.slug}
                    href={`/${lang}/crafts/${tr.slug}`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
                  >
                    <Icon aria-hidden className="h-4 w-4 text-primary" />
                    {ar ? tr.name_ar : tr.name_en}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Category discovery: nine compact cards, each expandable in place.
            The closed card shows the icon, the group, a count and a taste of
            what is inside; opening it reveals every trade as a link. All 47
            trade links are in the HTML either way — nothing is hidden from a
            crawler, only folded away from a first glance. */}
        <section className="mt-8 sm:mt-10">
          <h2 className="text-lg font-extrabold">{t.allTrades}</h2>
          <div className="mt-3 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const GIcon = groupIcon(g.slug);
              const preview = g.trades
                .slice(0, 4)
                .map((tr) => (ar ? tr.name_ar : tr.name_en))
                .join(" · ");
              return (
                <details
                  key={g.slug}
                  className="group rounded-2xl border border-border bg-surface"
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <GIcon aria-hidden className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <h3 className="truncate font-bold">
                          {ar ? g.name_ar : g.name_en}
                        </h3>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                          {t.tradesCount.replace("{n}", String(g.trades.length))}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {preview}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="flex flex-wrap gap-2 border-t border-border p-4 pt-3">
                    {g.trades.map((tr) => (
                      <Link
                        key={tr.slug}
                        href={`/${lang}/crafts/${tr.slug}`}
                        className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                      >
                        {ar ? tr.name_ar : tr.name_en}
                        {(counts[tr.slug] ?? 0) > 0 && (
                          <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                            {counts[tr.slug]}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        {/* Providers — rendered only when they exist. An empty grid with a
            heading over it would just certify the emptiness. */}
        {featured.length > 0 && (
          <section className="mt-8 sm:mt-10">
            <h2 className="text-lg font-extrabold">{t.providers}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {featured.map((p) => (
                <CraftCard
                  key={p.id}
                  provider={p}
                  lang={lang}
                  labels={{
                    from: t.from,
                    verified: t.verified,
                    noRating: t.noRating,
                    covers: t.covers,
                    works: t.works,
                    years: t.years,
                    viewProfile: t.viewProfile,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* The request path that works at zero supply. craft_requests requires
            a provider_id (NOT NULL, and the rate-limit policy counts per
            provider), so a stored provider-less request is impossible without
            a schema change — the honest fallback is the platform's own
            WhatsApp line with a prefilled message. */}
        <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-extrabold">{t.requestHelpTitle}</h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            {t.requestHelpBody}
          </p>
          <a
            href={supportWaLink(t.waRequestGeneric)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-whatsapp px-5 py-2.5 text-sm font-bold text-whatsapp-foreground transition-colors hover:bg-whatsapp-hover"
          >
            <MessageCircle aria-hidden className="h-4 w-4" />
            {t.requestHelpCta}
          </a>
        </section>

        {/* Supply is the bottleneck; this is the CTA that fixes it. */}
        <section className="mt-4 flex flex-col items-start gap-3 rounded-2xl bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-extrabold">{t.recruitTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.recruitBody}</p>
          </div>
          <Link
            href={`/${lang}/crafts/join`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t.joinCta}
          </Link>
        </section>
      </Container>
    </div>
  );
}
