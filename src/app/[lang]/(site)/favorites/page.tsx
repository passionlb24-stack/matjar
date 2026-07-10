import { notFound, redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
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
    <div className="py-10">
      <Container>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {dict.favorites.title}
        </h1>

        {stores.length ? (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stores.map((s) => (
              <StoreCard key={s.id} store={s} lang={lang as Locale} dict={dict} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Heart className="h-7 w-7" />
            </span>
            <p className="mt-4 text-muted-foreground">{dict.favorites.empty}</p>
          </div>
        )}
      </Container>
    </div>
  );
}
