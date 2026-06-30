import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { stores } from "@/lib/catalog";
import { ExploreClient } from "@/components/explore-client";

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return <ExploreClient lang={lang} dict={dict} stores={stores} />;
}
