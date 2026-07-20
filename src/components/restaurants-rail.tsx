import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getRestaurants } from "@/lib/data/home";
import { StoreRail } from "@/components/store-rail";

// "Restaurants near you" — food-category stores in a rail. Streams inside its
// own <Suspense> on the homepage; renders nothing if there are no food stores
// (no empty text passed) so the page doesn't show a dead section early on.
export async function RestaurantsRail({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const stores = await getRestaurants(8);
  if (!stores.length) return null;

  return (
    <StoreRail
      stores={stores}
      lang={lang}
      dict={dict}
      title={dict.home2.restaurantsTitle}
      subtitle={dict.home2.restaurantsSubtitle}
      href={`/${lang}/category/food`}
      seeAll={dict.home2.seeAll}
    />
  );
}
