import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, Wrench } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CraftCard } from "@/components/crafts/craft-card";
import {
  browseCrafts,
  getAreasByRegion,
  getTrade,
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
// providers — and keeps the filters to the two that decide anything here, the
// area they cover and how they are sorted.
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

  const [providers, areasByRegion] = await Promise.all([
    browseCrafts({
      trade: isAll ? null : trade,
      area: area || null,
      q: q || null,
      sort,
      limit: 60,
    }),
    getAreasByRegion(),
  ]);

  const tradeName = tradeRow
    ? ar
      ? tradeRow.name_ar
      : tradeRow.name_en
    : q || t.allTrades;

  const allAreas: AreaRef[] = Object.values(areasByRegion).flat();
  const activeArea = allAreas.find((a) => a.slug === area);

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
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {t.title}
        </Link>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {tradeRow?.icon && <span aria-hidden>{tradeRow.icon} </span>}
          {tradeName}
          {activeArea && (
            <span className="text-muted-foreground">
              {" "}
              — {ar ? activeArea.name_ar : activeArea.name_en}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {providers.length
            ? t.resultCount.replace("{n}", String(providers.length))
            : t.noResultsShort}
        </p>

        {/* Area — the filter that decides everything in this section. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={hrefWith({ area: "" })}
            aria-current={!area ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
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
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                area === a.slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface hover:border-primary/40"
              }`}
            >
              {ar ? a.name_ar : a.name_en}
            </Link>
          ))}
        </div>

        {/* Sorting. "Most requested" is deliberately absent — there is no
            request volume behind it yet, and a sort that ranks on nothing is a
            lie told in a dropdown. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t.sortBy}</span>
          {(
            [
              ["rating", t.sortRating],
              ["reviews", t.sortReviews],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={hrefWith({ sort: key })}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                sort === key
                  ? "bg-surface-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

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
                }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6">
            {/* Says which of the two filters emptied the page, so the next tap
                is obvious instead of a guess. */}
            <EmptyState
              icon={Wrench}
              title={
                activeArea
                  ? t.noneInArea
                      .replace("{trade}", tradeName)
                      .replace(
                        "{area}",
                        ar ? activeArea.name_ar : activeArea.name_en,
                      )
                  : t.noneYet.replace("{trade}", tradeName)
              }
              description={activeArea ? t.tryAnywhere : t.emptyBody}
              action={
                activeArea
                  ? { href: hrefWith({ area: "" }), label: t.showAllAreas }
                  : { href: `/${lang}/merchants`, label: t.joinCta }
              }
            />
          </div>
        )}
      </Container>
    </div>
  );
}
