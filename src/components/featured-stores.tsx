import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getFeaturedStores } from "@/lib/data/stores";
import { StoreRail } from "@/components/store-rail";
import { railOnlyIfEnough } from "@/lib/rail";

export async function FeaturedStores({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const stores = await getFeaturedStores(8);

  return (
    <StoreRail
      // Phones drop the row below three stores — including the "no featured
      // stores yet" placeholder, which is a dead section on a small screen.
      className={railOnlyIfEnough(stores.length)}
      stores={stores}
      lang={lang}
      dict={dict}
      title={dict.featured.title}
      subtitle={dict.featured.subtitle}
      href={`/${lang}/explore`}
      seeAll={dict.featured.viewAll}
      emptyText={dict.featured.emptyBody}
    />
  );
}
