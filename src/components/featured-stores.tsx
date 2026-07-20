import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getFeaturedStores } from "@/lib/data/stores";
import { StoreRail } from "@/components/store-rail";

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
