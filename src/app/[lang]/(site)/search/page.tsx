import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchX, Package, ShoppingBag } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { searchAll } from "@/lib/data/search";
import { getDiscoveryCoverage } from "@/lib/data/discovery";
import { getUsdLbpRate } from "@/lib/data/settings";
import { groupBySector, sectorOptions } from "@/lib/discovery";
import { categoryIcons } from "@/components/category-icon";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { StoreCard } from "@/components/store-card";
import { ProductMiniCard } from "@/components/product-mini-card";
import { MarketListingCard } from "@/components/market-listing-card";
import { TrackSearch } from "@/components/track-search";
import { SearchBox } from "@/components/search/search-box";
import { RecentSearches } from "@/components/search/recent-searches";
import { SectorShortcuts } from "@/components/search/sector-shortcuts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.search.title };
}

/**
 * Search, as a screen rather than a query string with a list under it.
 *
 * One route serves both halves of the same act. With no term it is what you
 * land on when you tap search and have not decided the word yet: a field with
 * the keyboard already up, your own recent searches, and the sectors that
 * actually have stores. With a term it is the answer — and it keeps the field,
 * so correcting one letter does not mean going back out to the header.
 *
 * Two rules run through it. Nothing is a group unless it has rows: the sector
 * headings are read off the results, so "مطاعم" cannot appear above an empty
 * list. And nothing is invented — there is no "trending" block, because the
 * table that would have to supply it holds two rows from one minute of one day.
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; region?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const l = lang as Locale;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const t = dict.search;

  // Coverage is the same sixty-second cached read the discovery pages make, so
  // wanting it on both halves of this screen costs one round trip platform-wide
  // rather than one per search.
  const [results, lbpRate, coverage] = await Promise.all([
    q ? searchAll(q, l, sp.region) : null,
    q ? getUsdLbpRate() : Promise.resolve(0),
    getDiscoveryCoverage(),
  ]);

  const stores = results?.stores ?? [];
  const products = results?.products ?? [];
  const listings = results?.listings ?? [];
  const total = stores.length + products.length + listings.length;
  const storeGroups = groupBySector(stores);

  // The browse blocks belong where there is nothing else to read: before a term
  // is typed, and after one came back with nothing. Above a page of answers
  // they are furniture between the buyer and what they asked for.
  const showBrowse = !q || total === 0;

  return (
    <div className="pb-16">
      <Container className="py-6 sm:py-8">
        {/* The page where somebody types what they want was the one page that
            never recorded it. A search that returns 0 here is a merchant this
            marketplace has not recruited yet, named by a customer. */}
        {q && (
          <TrackSearch
            q={q}
            section="search"
            results={total}
            region={sp.region ?? null}
          />
        )}

        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {q ? (
            <>
              {t.resultsFor}{" "}
              <span className="text-primary">&ldquo;{q}&rdquo;</span>
            </>
          ) : (
            t.title
          )}
        </h1>

        <SearchBox
          lang={lang}
          initial={q}
          labels={{
            placeholder: dict.hero.searchPlaceholder,
            submit: t.openSearch,
            clear: t.clear,
          }}
          className="mt-4"
        />

        {q ? (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-bold tabular-nums text-foreground">
              {total}
            </span>{" "}
            {t.resultsCount}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t.prompt}</p>
        )}

        {/* No `action` on purpose. The way out of a search that found nothing
            is the two blocks below — the buyer's own recent terms, and the
            sectors that really have stores — and a third button repeating that
            offer would be the only 40px target on this screen. */}
        {q && total === 0 && (
          <EmptyState
            className="mt-6"
            icon={SearchX}
            title={t.empty}
            description={t.emptyHint}
          />
        )}

        {total > 0 && (
          <div className="mt-8 space-y-10">
            {/* One section per sector that actually returned a store. A butcher
                and a restaurant are not "results", they are two different
                answers, and the heading is the only thing that says which. */}
            {storeGroups.map(({ sector, items }) => {
              const Icon = categoryIcons[sector];
              const id = `sec-${sector}`;
              return (
                <section key={sector} aria-labelledby={id}>
                  <h2
                    id={id}
                    className="mb-4 flex items-center gap-2 text-lg font-extrabold"
                  >
                    <Icon aria-hidden className="h-5 w-5 text-primary" />
                    {dict.catalog[sector].name}
                    <span className="text-sm font-medium text-muted-foreground tabular-nums">
                      ({items.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {items.map((store) => (
                      <StoreCard
                        key={store.id}
                        store={store}
                        lang={l}
                        dict={dict}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {products.length > 0 && (
              <section aria-labelledby="sec-products">
                <h2
                  id="sec-products"
                  className="mb-4 flex items-center gap-2 text-lg font-extrabold"
                >
                  <Package aria-hidden className="h-5 w-5 text-primary" />
                  {t.products}
                  <span className="text-sm font-medium text-muted-foreground tabular-nums">
                    ({products.length})
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {products.map((p) => (
                    <ProductMiniCard
                      key={p.id}
                      lang={l}
                      id={p.id}
                      name={p.name}
                      nameEn={p.nameEn}
                      price={p.price}
                      discountPrice={p.discountPrice}
                      imageUrl={p.imageUrl}
                      storeName={p.storeName}
                      lbpRate={lbpRate}
                    />
                  ))}
                </div>
              </section>
            )}

            {listings.length > 0 && (
              <section aria-labelledby="sec-listings">
                <h2
                  id="sec-listings"
                  className="mb-4 flex items-center gap-2 text-lg font-extrabold"
                >
                  <ShoppingBag aria-hidden className="h-5 w-5 text-primary" />
                  {t.listings}
                  <span className="text-sm font-medium text-muted-foreground tabular-nums">
                    ({listings.length})
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {listings.map((listing) => (
                    <MarketListingCard
                      key={listing.id}
                      listing={listing}
                      lang={l}
                      dict={dict}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {showBrowse && (
          <div className="mt-8 space-y-8">
            <RecentSearches
              lang={lang}
              titleId="sec-recent"
              labels={{ title: t.recent, clear: t.clear }}
            />
            <SectorShortcuts
              title={dict.categories.title}
              titleId="sec-browse"
              options={sectorOptions(coverage)}
              names={dict.catalog}
              countLabel={dict.discovery.storesCount}
              href={(key) => `/${lang}/category/${key}`}
            />
          </div>
        )}
      </Container>
    </div>
  );
}
