import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, MessageCircle, Wrench } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CraftCard } from "@/components/crafts/craft-card";
import { tradeIcon } from "@/lib/trade-icons";
import { supportWaLink } from "@/lib/support";
import {
  browseCrafts,
  getAreasByRegion,
  getTrade,
  getTradeGroups,
  type AreaRef,
} from "@/lib/data/crafts";

type Params = Promise<{ lang: string; trade: string }>;
type Search = Promise<{ area?: string; q?: string; sort?: string }>;

/** "all" is the escape hatch for a free-text search that matched no trade. */
const ALL = "all";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, trade } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  if (trade === ALL) return { title: dict.crafts.title };

  const t = await getTrade(trade);
  if (!t) return {};
  const name = lang === "ar" ? t.name_ar : t.name_en;
  // A real title for a real page: "كهربائي في لبنان — متجر".
  return {
    title: dict.crafts.metaTitle.replace("{trade}", name),
    description: dict.crafts.metaDesc.replace("{trade}", name),
  };
}

// One trade, filtered by area.
//
// This is the page that should rank: someone searching "كهربائي طرابلس" is not
// browsing, they have a problem right now. So it opens with the answer — the
// providers when there are any, and when there are none, a compact and honest
// path to still getting the job done: send the request over WhatsApp so it can
// be routed to craftsmen as they join. Sibling trades of the same group sit
// below as chips, because "سبّاك" and "عزل ورطوبة" are often the same leak.
export default async function TradePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { lang, trade } = await params;
  if (!isLocale(lang)) notFound();
  const { area = "", q = "", sort = "rating" } = await searchParams;
  const dict = await getDictionary(lang);
  const t = dict.crafts;
  const ar = lang === "ar";

  const isAll = trade === ALL;
  const tradeRow = isAll ? null : await getTrade(trade);
  if (!isAll && !tradeRow) notFound();

  const [providers, areasByRegion, groups] = await Promise.all([
    browseCrafts({
      trade: isAll ? null : trade,
      area: area || null,
      q: q || null,
      sort,
      limit: 60,
    }),
    getAreasByRegion(),
    getTradeGroups(),
  ]);

  const tradeName = tradeRow
    ? ar
      ? tradeRow.name_ar
      : tradeRow.name_en
    : q || t.allTrades;

  const allAreas: AreaRef[] = Object.values(areasByRegion).flat();
  const activeArea = allAreas.find((a) => a.slug === area);
  const activeAreaName = activeArea
    ? ar
      ? activeArea.name_ar
      : activeArea.name_en
    : null;

  const siblings = tradeRow
    ? (groups.find((g) => g.slug === tradeRow.group_slug)?.trades ?? []).filter(
        (tr) => tr.slug !== tradeRow.slug,
      )
    : [];

  const TradeIcon = tradeRow
    ? tradeIcon(tradeRow.slug, tradeRow.group_slug)
    : Wrench;

  // The WhatsApp fallback carries the trade (and area, when filtered) so the
  // support line knows what is being asked for without a single extra question.
  const waText = tradeRow
    ? activeAreaName
      ? t.waRequestTradeArea
          .replace("{trade}", tradeName)
          .replace("{area}", activeAreaName)
      : t.waRequestTrade.replace("{trade}", tradeName)
    : t.waRequestGeneric;

  /** Keeps the other filters while changing one. */
  const hrefWith = (next: { area?: string; sort?: string }) => {
    const p = new URLSearchParams();
    const a = next.area ?? area;
    const s = next.sort ?? sort;
    if (a) p.set("area", a);
    if (q) p.set("q", q);
    if (s && s !== "rating") p.set("sort", s);
    return `/${lang}/crafts/${trade}${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="py-8 sm:py-10">
      <Container>
        <Link
          href={`/${lang}/crafts`}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {t.title}
        </Link>

        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <TradeIcon aria-hidden className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {tradeName}
              {activeAreaName && (
                <span className="text-muted-foreground"> — {activeAreaName}</span>
              )}
            </h1>
            {providers.length > 0 && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t.resultCount.replace("{n}", String(providers.length))}
              </p>
            )}
          </div>
        </div>

        {/* Area — the filter that decides everything in this section. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={hrefWith({ area: "" })}
            aria-current={!area ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
              !area
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface hover:border-primary/40"
            }`}
          >
            {t.anywhere}
          </Link>
          {allAreas.slice(0, 14).map((a) => (
            <Link
              key={a.slug}
              href={hrefWith({ area: a.slug })}
              aria-current={area === a.slug ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                area === a.slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface hover:border-primary/40"
              }`}
            >
              {ar ? a.name_ar : a.name_en}
            </Link>
          ))}
        </div>

        {/* Sorting exists only when there is something to sort. "Most
            requested" is deliberately absent — there is no request volume
            behind it yet, and a sort that ranks on nothing is a lie told in a
            dropdown. */}
        {providers.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t.sortBy}</span>
            {(
              [
                ["rating", t.sortRating],
                ["reviews", t.sortReviews],
                ["completed", t.sortCompleted],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={hrefWith({ sort: key })}
                className={`inline-flex min-h-11 items-center rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  sort === key
                    ? "bg-surface-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}

        {providers.length ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {providers.map((p) => (
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
        ) : activeArea ? (
          <div className="mt-6">
            {/* The area filter emptied the page — the next tap is obvious:
                widen the net before giving up on the trade. */}
            <EmptyState
              icon={Wrench}
              title={t.noneInArea
                .replace("{trade}", tradeName)
                .replace("{area}", activeAreaName ?? "")}
              description={t.tryAnywhere}
              action={{ href: hrefWith({ area: "" }), label: t.showAllAreas }}
            />
          </div>
        ) : (
          /* Zero providers for the trade itself. Compact, and it converts:
             the request still has somewhere real to go. craft_requests cannot
             store a provider-less request (provider_id is NOT NULL), so the
             working path is the platform's WhatsApp line, prefilled with the
             trade so nothing needs retyping. */
          <div className="mt-6 rounded-2xl border border-dashed border-border p-5 sm:p-6">
            <h2 className="font-extrabold">{t.requestFallbackTitle}</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              {t.requestHelpBody}
            </p>
            <a
              href={supportWaLink(waText)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              {t.requestHelpCta}
            </a>
          </div>
        )}

        {/* The same leak is often another trade's job. */}
        {siblings.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-extrabold text-muted-foreground">
              {t.relatedTrades}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {siblings.map((tr) => (
                <Link
                  key={tr.slug}
                  href={`/${lang}/crafts/${tr.slug}`}
                  className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                >
                  {ar ? tr.name_ar : tr.name_en}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Supply is the bottleneck — recruit on the page that proves demand. */}
        <section className="mt-8 flex flex-col items-start gap-3 rounded-2xl bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between">
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
