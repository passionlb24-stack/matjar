import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";

// Saved products used to live here, on a screen no tab reached (MP-024). They
// are now the products segment of /favorites, so this route redirects instead
// of being deleted: customers bookmark the page their saved things are on, and
// the "wishlist" name is still what the product heart's own copy calls it.
//
// Same shape as following/page.tsx, which did this for saved stores first.
export default async function WishlistPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  redirect(`/${lang}/favorites?tab=products`);
}
