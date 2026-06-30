import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { Hero } from "@/components/hero";
import { TrustStrip } from "@/components/trust-strip";
import { CategoryGrid } from "@/components/category-grid";
import { OffersTeaser } from "@/components/offers-teaser";
import { BestSellersTeaser } from "@/components/best-sellers-teaser";
import { FeaturedStores } from "@/components/featured-stores";
import { HowItWorks } from "@/components/how-it-works";
import { MerchantCta } from "@/components/merchant-cta";

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <>
      <Hero lang={lang} dict={dict} />
      <TrustStrip dict={dict} />
      <CategoryGrid lang={lang} dict={dict} />
      <OffersTeaser lang={lang} dict={dict} />
      <FeaturedStores lang={lang} dict={dict} />
      <BestSellersTeaser lang={lang} dict={dict} />
      <HowItWorks dict={dict} />
      <MerchantCta lang={lang} dict={dict} />
    </>
  );
}
