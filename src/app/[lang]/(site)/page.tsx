import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { localeAlternates, SITE_URL } from "@/lib/site";
import { siteJsonLd, jsonLdScript } from "@/lib/jsonld";
import { getDailyDeal } from "@/lib/data/offers";
import { getUsdLbpRate } from "@/lib/data/settings";
import { getHomeCounts } from "@/lib/data/home";
import { DealOfTheDay } from "@/components/deal-of-the-day";
import { Hero } from "@/components/hero";
import { TrustStrip } from "@/components/trust-strip";
import { BusinessOs } from "@/components/business-os";
import { WorldsShowcase } from "@/components/worlds-showcase";
import { ServicesGrid } from "@/components/services-grid";
import { OffersTeaser } from "@/components/offers-teaser";
import { BestSellersTeaser } from "@/components/best-sellers-teaser";
import { FeaturedStores } from "@/components/featured-stores";
import { RestaurantsRail } from "@/components/restaurants-rail";
import { CitiesStrip } from "@/components/cities-strip";
import { HomePromoSplit } from "@/components/home-promo-split";
import { LatestJobs } from "@/components/latest-jobs";
import { ForYouStrip } from "@/components/for-you-strip";
import { HomeStats } from "@/components/home-stats";
import { HowItWorks } from "@/components/how-it-works";
import { HomeFaq } from "@/components/home-faq";
import { MerchantCta } from "@/components/merchant-cta";
import { SectionSkeleton } from "@/components/section-skeleton";
import { dictSlice } from "@/lib/dict-slice";

// Self-fetching deal section so its DB query streams instead of blocking the
// whole page (fetches deal + LBP rate only here).
async function DealSection({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const [deal, lbpRate] = await Promise.all([getDailyDeal(), getUsdLbpRate()]);
  if (!deal) return null;
  return (
    <DealOfTheDay
      deal={deal}
      lang={lang}
      dict={dictSlice(dict, ["deal"])}
      lbpRate={lbpRate}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { alternates: localeAlternates(lang, "") };
}

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  // Real, cached platform counts (stores + listings) for the honest stat rows.
  const counts = await getHomeCounts();

  // The Hero + static sections render in the shell immediately. Every
  // data-backed section streams inside its own <Suspense> so a slow query
  // never blocks first paint. Order tells the V2 story: hero → the 8 worlds
  // (breadth) → trending/curated → proof (stats) → how it works → convert.
  // Phones re-sequence that story in CSS — see the wrapper below.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            siteJsonLd({
              siteUrl: SITE_URL,
              lang,
              name: dict.common.brand,
              description: dict.hero.subtitle,
            }),
          ),
        }}
      />
      {/* Phones read this page in a different order than desktop, from the
          same tree and the same queries. Below `lg` it is a flex column and
          `order` decides the sequence: categories then the discovery rails sit
          straight under the header's search, and the merchant pitch drops to
          the bottom where a shopper is not standing in front of it. At `lg`
          the wrapper goes back to block flow, `order` stops applying, and
          source order — untouched below — is what desktop renders. */}
      <div className="flex flex-col lg:block">
        <div className="-order-6">
          <Hero lang={lang} dict={dict} storeCount={counts.stores} />
        </div>
        <TrustStrip dict={dict} />
        <div className="order-1">
          <BusinessOs lang={lang} dict={dict} />
        </div>
        <div className="-order-5">
          <WorldsShowcase lang={lang} dict={dict} />
        </div>
        <Suspense fallback={null}>
          <DealSection lang={lang} dict={dict} />
        </Suspense>
        {/* Per-user "For you" strip. Client island: fetches its own data in the
            browser after load, so it adds no per-user server read and keeps this
            page cacheable. Renders nothing for anon / no-history users. */}
        <ForYouStrip
          lang={lang}
          dict={dictSlice(dict, ["home", "catalog", "explore", "featured"])}
        />
        <div className="-order-4">
          <Suspense fallback={<SectionSkeleton cards={4} />}>
            <FeaturedStores lang={lang} dict={dict} />
          </Suspense>
        </div>
        <div className="-order-1">
          <Suspense fallback={null}>
            <RestaurantsRail lang={lang} dict={dict} />
          </Suspense>
        </div>
        <div className="-order-2">
          <Suspense fallback={<SectionSkeleton cards={4} />}>
            <OffersTeaser lang={lang} dict={dict} />
          </Suspense>
        </div>
        <CitiesStrip lang={lang} dict={dict} />
        <div className="-order-3">
          <Suspense fallback={<SectionSkeleton cards={4} />}>
            <BestSellersTeaser lang={lang} dict={dict} />
          </Suspense>
        </div>
        <HomePromoSplit lang={lang} dict={dict} />
        <ServicesGrid lang={lang} dict={dict} />
        <Suspense fallback={null}>
          <LatestJobs lang={lang} dict={dict} />
        </Suspense>
        <HomeStats
          lang={lang}
          dict={dict}
          storeCount={counts.stores}
          productCount={counts.products}
        />
        <HowItWorks dict={dict} />
        <HomeFaq dict={dictSlice(dict, ["homeFaq"])} />
        <MerchantCta lang={lang} dict={dict} />
      </div>
    </>
  );
}
