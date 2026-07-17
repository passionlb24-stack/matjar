import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { categoryKeys, type CategoryKey } from "@/lib/catalog";
import { localeAlternates } from "@/lib/site";
import { getStoresForListing } from "@/lib/data/stores";
import { getUsdLbpRate } from "@/lib/data/settings";
import { ExploreClient } from "@/components/explore-client";

function isCategoryKey(value: string): value is CategoryKey {
  return (categoryKeys as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isCategoryKey(slug)) return {};
  const dict = await getDictionary(lang);
  const cat = dict.catalog[slug];
  const title = `${cat.name} — ${dict.common.brand}`;
  return {
    title,
    description: cat.desc,
    alternates: localeAlternates(lang, `/category/${slug}`),
    openGraph: { title, description: cat.desc },
    twitter: { card: "summary", title, description: cat.desc },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isCategoryKey(slug)) notFound();

  const dict = await getDictionary(lang);
  const [stores, lbpRate] = await Promise.all([
    getStoresForListing(),
    getUsdLbpRate(),
  ]);

  return (
    <ExploreClient
      lang={lang}
      dict={dict}
      stores={stores}
      lbpRate={lbpRate}
      initialCategory={slug}
    />
  );
}
