import { notFound, redirect } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import {
  getMarketCategories,
  getMarketCities,
  getMarketRegions,
} from "@/lib/data/market";
import { Container } from "@/components/ui/container";
import { ListingForm } from "@/components/listing-form";

export default async function NewListingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const l = lang as Locale;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const [categories, cities, marketRegions, { data: store }] = await Promise.all([
    getMarketCategories(l),
    getMarketCities(l),
    getMarketRegions(l),
    supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
  ]);
  const storeId = (store as { id?: string } | null)?.id ?? null;

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.market.form.newTitle}
        </h1>
        <div className="mt-6">
          <ListingForm
            lang={lang}
            dict={dict}
            categories={categories}
            cities={cities}
            regions={marketRegions}
            storeId={storeId}
          />
        </div>
      </Container>
    </div>
  );
}
