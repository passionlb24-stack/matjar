import { notFound, redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { StoreCard } from "@/components/store-card";
import type { CategoryKey, RegionKey, Store } from "@/lib/catalog";

type FavRow = {
  stores: {
    id: string;
    name: string;
    area: string | null;
    region: string | null;
    plan: "free" | "pro" | null;
    business_types: { slug: string } | null;
  } | null;
};

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);

  const { data } = await supabase
    .from("follows")
    .select("stores(id, name, area, region, plan, business_types(slug))")
    .eq("user_id", user.id);

  const stores: Store[] = ((data ?? []) as unknown as FavRow[])
    .map((f) => f.stores)
    .filter((s): s is NonNullable<FavRow["stores"]> => Boolean(s))
    .map((s) => ({
      id: s.id,
      name: { ar: s.name, en: s.name },
      area: { ar: s.area ?? "", en: s.area ?? "" },
      region: (s.region as RegionKey) ?? undefined,
      category: (s.business_types?.slug as CategoryKey) ?? "retail",
      isOpen: true,
      plan: s.plan ?? "free",
      favorited: true,
    }));

  return (
    <div className="pb-16">
      <PageHero title={dict.favorites.title} icon={Heart} />
      <Container className="py-8">
        {stores.length ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stores.map((s) => (
              <StoreCard key={s.id} store={s} lang={lang as Locale} dict={dict} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Heart}
            title={dict.favorites.empty}
            action={{ href: `/${lang}/explore`, label: dict.common.explore }}
          />
        )}
      </Container>
    </div>
  );
}
