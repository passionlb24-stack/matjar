import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Zap } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getUsdLbpRate } from "@/lib/data/settings";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { ProductMiniCard } from "@/components/product-mini-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.flash.title,
    description: dict.flash.subtitle,
    alternates: localeAlternates(lang, "/flash"),
  };
}

type Row = {
  id: string;
  name: string;
  name_en: string | null;
  price: number;
  flash_price: number;
  image_url: string | null;
  stores: { name: string; status: string; deleted_at: string | null } | null;
};

export default async function FlashPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, name_en, price, flash_price, flash_start, flash_end, image_url, stores(name, status, deleted_at)",
    )
    .not("flash_price", "is", null)
    .lte("flash_start", nowIso)
    .gt("flash_end", nowIso)
    .eq("status", "active")
    .eq("is_available", true)
    .is("deleted_at", null)
    .order("flash_end", { ascending: true });

  const rows = ((data ?? []) as unknown as Row[]).filter(
    (p) => p.stores && p.stores.status === "active" && !p.stores.deleted_at,
  );
  const lbpRate = await getUsdLbpRate();

  return (
    <div className="py-10">
      <Container>
        <div className="flex items-center gap-2">
          <Zap className="h-7 w-7 fill-amber-500 text-amber-500" />
          <h1 className="text-3xl font-extrabold tracking-tight">
            {dict.flash.title}
          </h1>
        </div>
        <p className="mt-1 text-muted-foreground">{dict.flash.subtitle}</p>

        {rows.length ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {rows.map((p) => (
              <ProductMiniCard
                key={p.id}
                lang={lang as Locale}
                id={p.id}
                name={p.name}
                nameEn={p.name_en}
                price={Number(p.price)}
                discountPrice={Number(p.flash_price)}
                imageUrl={p.image_url}
                storeName={p.stores?.name}
                lbpRate={lbpRate}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
              <Zap className="h-7 w-7" />
            </span>
            <p className="mt-4 text-muted-foreground">{dict.flash.empty}</p>
          </div>
        )}
      </Container>
    </div>
  );
}
