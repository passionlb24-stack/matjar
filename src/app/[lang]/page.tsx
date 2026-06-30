import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { CategoryGrid } from "@/components/category-grid";
import { FeaturedStores } from "@/components/featured-stores";
import { HowItWorks } from "@/components/how-it-works";
import { MerchantCta } from "@/components/merchant-cta";
import { SiteFooter } from "@/components/site-footer";

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
      <SiteHeader lang={lang} dict={dict} />
      <main>
        <Hero lang={lang} dict={dict} />
        <CategoryGrid lang={lang} dict={dict} />
        <FeaturedStores lang={lang} dict={dict} />
        <HowItWorks dict={dict} />
        <MerchantCta lang={lang} dict={dict} />
      </main>
      <SiteFooter lang={lang} dict={dict} />
    </>
  );
}
