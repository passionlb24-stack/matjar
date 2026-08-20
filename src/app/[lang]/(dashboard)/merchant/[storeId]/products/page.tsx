import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";

// ISS-018. `/products/[productId]` and `/products/import` exist; `/products`
// did not, so the one URL a merchant would guess after editing a product — trim
// the id off and land on the list — returned a 404. The list is deliberately at
// `/items` and stays there (merchants have it bookmarked, and the sector decides
// whether that word means menu, products, services or listings). So this is a
// redirect, not a second list: the segment stops being a dead end without the
// route being renamed or duplicated.
export default async function ProductsIndexPage({
  params,
}: {
  params: Promise<{ lang: string; storeId: string }>;
}) {
  const { lang, storeId } = await params;
  if (!isLocale(lang)) notFound();
  redirect(`/${lang}/merchant/${storeId}/items`);
}
