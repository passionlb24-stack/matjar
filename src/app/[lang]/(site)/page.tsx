import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
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
  const [deal, lbpRate] = await Promise.all([getDailyDeal(), getUsdLbpRate()]);

  return (
    <>
      <Hero lang={lang} dict={dict} />
      <TrustStrip dict={dict} />
      {deal && (
        <DealOfTheDay deal={deal} lang={lang} dict={dict} lbpRate={lbpRate} />
      )}
      <CategoryGrid lang={lang} dict={dict} />
      <ServicesGrid lang={lang} dict={dict} />
      <OffersTeaser lang={lang} dict={dict} />
      <FeaturedStores lang={lang} dict={dict} />
      <BestSellersTeaser lang={lang} dict={dict} />
      <HowItWorks dict={dict} />
      <MerchantCta lang={lang} dict={dict} />
    </>
  );
}
