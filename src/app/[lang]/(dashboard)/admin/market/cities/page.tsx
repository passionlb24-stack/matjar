import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import {
  MarketCityManager,
  type MarketCityRow,
} from "@/components/market-city-manager";

export default async function AdminMarketCitiesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data } = await supabase
    .from("market_cities")
    .select("id, region, name_ar, name_en, sort_order, is_active")
    .order("region", { ascending: true })
    .order("sort_order", { ascending: true });
  const cities = (data ?? []) as MarketCityRow[];

  return <MarketCityManager lang={lang} dict={dict} cities={cities} />;
}
