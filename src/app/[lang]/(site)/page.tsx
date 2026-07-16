import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { getDailyDeal } from "@/lib/data/offers";
import { getUsdLbpRate } from "@/lib/data/settings";
import { DealOfTheDay } from "@/components/deal-of-the-day";
import { Hero } from "@/components/hero";
import { TrustStrip } from "@/components/trust-strip";
import { CategoryGrid } from "@/components/category-grid";
import { ServicesGrid } from "@/components/services-grid";
import { OffersTeaser } from "@/components/offers-teaser";
import { BestSellersTeaser } from "@/components/best-sellers-teaser";
import { FeaturedStores } from "@/components/featured-stores";
import { HowItWorks } from "@/components/how-it-works";
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

  // The Hero + static sections (Trust, Category, Services, HowItWorks, CTA)
  // render in the shell immediately. Every data-backed section streams inside
  // its own <Suspense> so a slow query never blocks first paint.
  return (
    <>
      <Hero lang={lang} dict={dict} />
      <TrustStrip dict={dict} />
      <Suspense fallback={null}>
        <DealSection lang={lang} dict={dict} />
      </Suspense>
      <CategoryGrid lang={lang} dict={dict} />
      <ServicesGrid lang={lang} dict={dict} />
      <Suspense fallback={<SectionSkeleton cards={4} />}>
        <OffersTeaser lang={lang} dict={dict} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton cards={4} />}>
        <FeaturedStores lang={lang} dict={dict} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton cards={4} />}>
        <BestSellersTeaser lang={lang} dict={dict} />
      </Suspense>
      <HowItWorks dict={dict} />
      <MerchantCta lang={lang} dict={dict} />
    </>
  );
}
