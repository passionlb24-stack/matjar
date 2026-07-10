import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";

// "Following" and "Favorites" were two names for the same saved-stores
// relationship; they're now unified under /favorites. Keep this route as a
// permanent redirect so old links (and the store follow button's mental model)
// still land somewhere sensible.
export default async function FollowingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  redirect(`/${lang}/favorites`);
}
