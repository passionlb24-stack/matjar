import { notFound, redirect } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getMarketCategories } from "@/lib/data/market";
import { Container } from "@/components/ui/container";
import { ListingForm, type ListingInitial } from "@/components/listing-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  if (!UUID_RE.test(id)) redirect(`/${lang}/account`);
  const dict = await getDictionary(lang);
  const l = lang as Locale;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id, store_id, category_id, title, description, price, city, region, images, status")
    .eq("id", id)
    .maybeSingle();
  const row = listing as
    | {
        seller_id: string;
        store_id: string | null;
        category_id: string | null;
        title: string;
        description: string | null;
        price: number | null;
        city: string | null;
        region: string | null;
        images: unknown;
        status: string;
      }
    | null;
  if (!row || row.seller_id !== user.id) redirect(`/${lang}/account`);

  const categories = await getMarketCategories(l);
  const initial: ListingInitial = {
    title: row.title,
    description: row.description ?? "",
    price: row.price != null ? String(row.price) : "",
    categoryId: row.category_id ?? "",
    city: row.city ?? "",
    region: row.region ?? "",
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    status: row.status,
  };

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.market.form.editTitle}
        </h1>
        <div className="mt-6">
          <ListingForm
            lang={lang}
            dict={dict}
            categories={categories}
            storeId={row.store_id}
            initial={initial}
            listingId={id}
          />
        </div>
      </Container>
    </div>
  );
}
