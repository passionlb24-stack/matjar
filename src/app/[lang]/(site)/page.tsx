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

// Self-fetching deal section so its DB query streams instead of blocking the
// whole page (fetches deal + LBP rate only here).
async function DealSection({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const [deal, lbpRate] = await Promise.all([getDailyDeal(), getUsdLbpRate()]);
  if (!deal) return null;
  return <DealOfTheDay deal={deal} lang={lang} dict={dict} lbpRate={lbpRate} />;
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
      <Hero lang={lang} dict={dict} storeCount={counts.stores} />
      <TrustStrip dict={dict} />
      <BusinessOs lang={lang} dict={dict} />
      <WorldsShowcase lang={lang} dict={dict} />
      <Suspense fallback={null}>
        <DealSection lang={lang} dict={dict} />
      </Suspense>
      {/* Per-user "For you" strip. Client island: fetches its own data in the
          browser after load, so it adds no per-user server read and keeps this
          page cacheable. Renders nothing for anon / no-history users. */}
      <ForYouStrip lang={lang} dict={dict} />
      <Suspense fallback={<SectionSkeleton cards={4} />}>
        <FeaturedStores lang={lang} dict={dict} />
      </Suspense>
      <Suspense fallback={null}>
        <RestaurantsRail lang={lang} dict={dict} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton cards={4} />}>
        <OffersTeaser lang={lang} dict={dict} />
      </Suspense>
      <CitiesStrip lang={lang} dict={dict} />
      <Suspense fallback={<SectionSkeleton cards={4} />}>
        <BestSellersTeaser lang={lang} dict={dict} />
      </Suspense>
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
      <HomeFaq dict={dict} />
      <MerchantCta lang={lang} dict={dict} />
    </>
  );
}
