import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Store as StoreIcon } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import {
  getMarketCategories,
  getMarketCities,
  getActiveListings,
  type ListingFilters,
} from "@/lib/data/market";
import { Container } from "@/components/ui/container";
import { MarketFilters } from "@/components/market-filters";
import { MarketListingCard } from "@/components/market-listing-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.market.title,
    description: dict.market.subtitle,
    openGraph: { title: dict.market.title, description: dict.market.subtitle },
  };
}

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const l = lang as Locale;
  const sp = await searchParams;

  const filters: ListingFilters = {
    q: sp.q,
    category: sp.category,
    region: sp.region,
    city: sp.city,
    priceMin: sp.min ? Number(sp.min) : undefined,
    priceMax: sp.max ? Number(sp.max) : undefined,
    sort: (sp.sort as ListingFilters["sort"]) ?? "newest",
  };

  const [categories, cities, listings] = await Promise.all([
    getMarketCategories(l),
    getMarketCities(l),
    getActiveListings(l, filters),
  ]);
  const featured = listings.filter((x) => x.isFeatured);
  const rest = listings.filter((x) => !x.isFeatured);

  return (
    <div className="py-10">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <StoreIcon className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                {dict.market.title}
              </h1>
            </div>
            <p className="mt-2 text-muted-foreground">{dict.market.subtitle}</p>
          </div>
          <Link
            href={`/${lang}/market/new`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            {dict.market.publish}
          </Link>
        </div>

        <div className="mt-6">
          <MarketFilters
            lang={lang}
            dict={dict}
            categories={categories}
            cities={cities}
            initial={{
              q: sp.q ?? "",
              category: sp.category ?? "all",
              region: sp.region ?? "all",
              city: sp.city ?? "",
              priceMin: sp.min ?? "",
              priceMax: sp.max ?? "",
              sort: sp.sort ?? "newest",
            }}
          />
        </div>

        {featured.length > 0 && (
          <>
            <h2 className="mb-4 mt-8 text-xl font-bold">{dict.market.featured}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((x) => (
                <MarketListingCard key={x.id} listing={x} lang={lang} dict={dict} />
              ))}
            </div>
          </>
        )}

        <div className="mb-4 mt-8 flex items-center justify-between">
          <h2 className="text-xl font-bold">{dict.market.newest}</h2>
          <span className="text-sm text-muted-foreground">
            {listings.length} {dict.market.results}
          </span>
        </div>
        {rest.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {rest.map((x) => (
              <MarketListingCard key={x.id} listing={x} lang={lang} dict={dict} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {dict.market.empty}
          </div>
        )}
      </Container>
    </div>
  );
}
