import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Store as StoreIcon } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import {
  getMarketCategories,
  getMarketCities,
  getMarketRegions,
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
    datePosted: sp.date as ListingFilters["datePosted"],
    sort: (sp.sort as ListingFilters["sort"]) ?? "newest",
  };

  const PAGE_SIZE = 24;
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [categories, cities, marketRegions, listings] = await Promise.all([
    getMarketCategories(l),
    getMarketCities(l),
    getMarketRegions(l),
    getActiveListings(l, filters, PAGE_SIZE, offset),
  ]);
  const hasMore = listings.length === PAGE_SIZE;

  // Preserve active filters across page links (drop the page param itself).
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/${lang}/market${qs ? `?${qs}` : ""}`;
  };

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
            regions={marketRegions}
            initial={{
              q: sp.q ?? "",
              category: sp.category ?? "all",
              region: sp.region ?? "all",
              city: sp.city ?? "",
              priceMin: sp.min ?? "",
              priceMax: sp.max ?? "",
              datePosted: sp.date ?? "any",
              sort: sp.sort ?? "newest",
            }}
          />
        </div>

        <div className="mb-4 mt-8 flex items-center justify-between">
          <h2 className="text-xl font-bold">{dict.market.newest}</h2>
          {page > 1 && (
            <span className="text-sm text-muted-foreground">
              {dict.market.page} {page}
            </span>
          )}
        </div>
        {listings.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((x) => (
              <MarketListingCard key={x.id} listing={x} lang={lang} dict={dict} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            {page > 1 ? dict.market.noMore : dict.market.empty}
          </div>
        )}

        {(page > 1 || hasMore) && (
          <div className="mt-8 flex items-center justify-center gap-3">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:bg-surface-muted"
              >
                {dict.market.prevPage}
              </Link>
            ) : (
              <span />
            )}
            {hasMore && (
              <Link
                href={pageHref(page + 1)}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {dict.market.nextPage}
              </Link>
            )}
          </div>
        )}
      </Container>
    </div>
  );
}
