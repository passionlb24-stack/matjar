import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Search as SearchIcon, Store as StoreIcon, Package, ShoppingBag } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { searchAll } from "@/lib/data/search";
import { getUsdLbpRate } from "@/lib/data/settings";
import { Container } from "@/components/ui/container";
import { StoreCard } from "@/components/store-card";
import { ProductMiniCard } from "@/components/product-mini-card";
import { MarketListingCard } from "@/components/market-listing-card";

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
  const q = (sp.q ?? "").trim();

  const t = dict.search;

  if (!q) {
    return (
      <div className="py-16">
        <Container className="max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <SearchIcon className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold">{t.title}</h1>
          <p className="mt-2 text-muted-foreground">{t.prompt}</p>
        </Container>
      </div>
    );
  }

  const [results, lbpRate] = await Promise.all([
    searchAll(q, l, sp.region),
    getUsdLbpRate(),
  ]);
  const total =
    results.stores.length + results.products.length + results.listings.length;

  return (
    <div className="py-10">
      <Container>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.resultsFor}{" "}
          <span className="text-primary">&ldquo;{q}&rdquo;</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} {t.resultsCount}
        </p>

        {total === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="font-bold">{t.empty}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.emptyHint}</p>
          </div>
        )}

        {results.stores.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold">
              <StoreIcon className="h-5 w-5 text-primary" />
              {t.stores}
              <span className="text-sm font-medium text-muted-foreground">
                ({results.stores.length})
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {results.stores.map((store) => (
                <StoreCard key={store.id} store={store} lang={l} dict={dict} />
              ))}
            </div>
          </section>
        )}

        {results.products.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold">
              <Package className="h-5 w-5 text-primary" />
              {t.products}
              <span className="text-sm font-medium text-muted-foreground">
                ({results.products.length})
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {results.products.map((p) => (
                <ProductMiniCard
                  key={p.id}
                  lang={l}
                  id={p.id}
                  name={p.name}
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

        {results.listings.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold">
              <ShoppingBag className="h-5 w-5 text-primary" />
              {t.listings}
              <span className="text-sm font-medium text-muted-foreground">
                ({results.listings.length})
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {results.listings.map((listing) => (
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
      </Container>
    </div>
  );
}
