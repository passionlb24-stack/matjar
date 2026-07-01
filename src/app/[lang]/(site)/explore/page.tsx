import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getStoresForListing } from "@/lib/data/stores";
import { regions, type RegionKey } from "@/lib/catalog";
import { ExploreClient } from "@/components/explore-client";

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; region?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const stores = await getStoresForListing();
  const { q, region } = await searchParams;
  const initialRegion: RegionKey | "all" = regions.some((r) => r.key === region)
    ? (region as RegionKey)
    : "all";

  return (
    <ExploreClient
      lang={lang}
      dict={dict}
      stores={stores}
      initialQuery={q ?? ""}
      initialRegion={initialRegion}
    />
  );
}
