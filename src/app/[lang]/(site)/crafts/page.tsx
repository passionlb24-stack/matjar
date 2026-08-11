import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wrench } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { CraftCard } from "@/components/crafts/craft-card";
import { CraftsSearch } from "@/components/crafts/crafts-search";
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

// The crafts directory.
//
// A different job from /freelance, and the page is shaped by that difference.
// A freelancer is chosen for their portfolio; a tradesman is chosen because
// they do the one thing that broke and they will come to your area today. So
// the page leads with the trade and the place, not with browsing.
//
// Trades with providers are shown first and the rest still listed, rather than
// hiding empty ones: a customer who searches for a سبّاك and finds the category
// missing assumes the site is useless, whereas an empty category with an honest
// count is a category someone might sign up to fill.
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

  const popular = groups
    .flatMap((g) => g.trades)
    .filter((tr) => (counts[tr.slug] ?? 0) > 0)
    .sort((a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0))
    .slice(0, 8);

  return (
    <div className="py-8 sm:py-10">
      <Container>
        {/* Hero: the two questions, and nothing else. */}
        <div className="rounded-3xl bg-gradient-to-b from-amber-500/12 via-amber-400/6 to-transparent p-6 sm:p-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
            <Wrench className="h-3.5 w-3.5" />
            {t.badge}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.heroTitle}
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">{t.heroSubtitle}</p>

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
        </div>

        {/* Most asked for — only trades that can actually answer. */}
        {popular.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-extrabold">{t.popular}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {popular.map((tr) => (
                <Link
                  key={tr.slug}
                  href={`/${lang}/crafts/${tr.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
                >
                  <span aria-hidden>{tr.icon}</span>
                  {ar ? tr.name_ar : tr.name_en}
                  <span className="text-xs font-normal text-muted-foreground">
                    {counts[tr.slug]}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Everything, grouped. */}
        <section className="mt-10">
          <h2 className="text-lg font-extrabold">{t.allTrades}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <div
                key={g.slug}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <h3 className="flex items-center gap-2 font-bold">
                  <span aria-hidden>{g.icon}</span>
                  {ar ? g.name_ar : g.name_en}
                </h3>
                <ul className="mt-2.5 space-y-1">
                  {g.trades.map((tr) => (
                    <li key={tr.slug}>
                      <Link
                        href={`/${lang}/crafts/${tr.slug}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-muted hover:text-primary"
                      >
                        <span className="truncate">
                          <span aria-hidden className="me-1">
                            {tr.icon}
                          </span>
                          {ar ? tr.name_ar : tr.name_en}
                        </span>
                        {(counts[tr.slug] ?? 0) > 0 && (
                          <span className="shrink-0 text-xs font-bold text-muted-foreground">
                            {counts[tr.slug]}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Providers. Empty until the first tradesman signs up — say so plainly
            and point at the way in, rather than showing an empty grid. */}
        <section className="mt-10">
          <h2 className="text-lg font-extrabold">{t.providers}</h2>
          {featured.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                icon={Wrench}
                title={t.emptyTitle}
                description={t.emptyBody}
                action={{ href: `/${lang}/merchants`, label: t.joinCta }}
              />
            </div>
          )}
        </section>
      </Container>
    </div>
  );
}
