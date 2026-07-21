import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { getStoresForListing } from "@/lib/data/stores";
import { getUsdLbpRate } from "@/lib/data/settings";
import { regions, groupKeys, type RegionKey, type GroupKey } from "@/lib/catalog";
import { ExploreClient } from "@/components/explore-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const title = lang === "ar" ? "تصفّح المتاجر" : "Explore stores";
  const description =
    lang === "ar"
      ? "اكتشف كل المتاجر والخدمات في لبنان حسب المنطقة والتصنيف — بمكان واحد."
      : "Browse every store and service in Lebanon by region and category — all in one place.";
  return { title, description, alternates: localeAlternates(lang, "/explore") };
}

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; region?: string; group?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const [stores, lbpRate] = await Promise.all([
    getStoresForListing(),
    getUsdLbpRate(),
  ]);
  const { q, region, group } = await searchParams;
  const initialRegion: RegionKey | "all" = regions.some((r) => r.key === region)
    ? (region as RegionKey)
    : "all";
  const initialGroup: GroupKey | "all" = (groupKeys as readonly string[]).includes(
    group ?? "",
  )
    ? (group as GroupKey)
    : "all";

  return (
    <ExploreClient
      lang={lang}
      dict={dict}
      stores={stores}
      lbpRate={lbpRate}
      initialQuery={q ?? ""}
      initialGroup={initialGroup}
      initialRegion={initialRegion}
    />
  );
}
