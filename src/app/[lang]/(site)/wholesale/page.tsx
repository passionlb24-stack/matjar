import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Boxes, Plus, ImageIcon } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates } from "@/lib/site";
import { WHOLESALE_CATEGORIES, type WholesaleProduct } from "@/lib/wholesale";
import { Container } from "@/components/ui/container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.wholesale.title,
    description: dict.wholesale.subtitle,
    alternates: localeAlternates(lang, "/wholesale"),
  };
}

function money(n: number) {
  return n >= 1000 ? `$${Number(n).toLocaleString("en-US")}` : `$${n}`;
}

export default async function WholesalePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { cat } = await searchParams;
  const dict = await getDictionary(lang);
  const t = dict.wholesale;

  const supabase = await createClient();
  let q = supabase
    .from("wholesale_products")
    .select("id, title, category, price, unit, moq, image_url")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(100);
  if (cat) q = q.eq("category", cat);
  const { data } = await q;
  const items = (data ?? []) as WholesaleProduct[];

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-primary bg-primary-soft text-primary"
        : "border-border text-muted-foreground hover:border-primary/40"
    }`;

  return (
    <div className="py-10">
      <Container>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
              <Boxes className="h-7 w-7 text-primary" />
              {t.title}
            </h1>
            <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
          </div>
          <Link
            href={`/${lang}/wholesale/new`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            {t.listProduct}
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/${lang}/wholesale`} className={chip(!cat)}>
            {t.allCategories}
          </Link>
          {WHOLESALE_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/${lang}/wholesale?cat=${c}`}
              className={chip(cat === c)}
            >
              {t.categories[c]}
            </Link>
          ))}
        </div>

        {items.length ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((w) => (
              <Link
                key={w.id}
                href={`/${lang}/wholesale/${w.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {w.image_url ? (
                  <Image
                    src={w.image_url}
                    alt={w.title}
                    width={300}
                    height={200}
                    className="h-36 w-full object-cover"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-36 w-full items-center justify-center bg-surface-muted">
                    <ImageIcon className="h-9 w-9 text-black/10" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-3">
                  <h2 className="line-clamp-2 text-sm font-bold leading-tight group-hover:text-primary">
                    {w.title}
                  </h2>
                  <div className="mt-auto pt-2">
                    {w.price != null && (
                      <p className="text-sm font-extrabold text-primary">
                        {money(Number(w.price))}
                        {w.unit ? ` / ${w.unit}` : ""}
                      </p>
                    )}
                    {w.moq != null && (
                      <p className="text-xs text-muted-foreground">
                        {t.moqShort}: {w.moq} {w.unit ?? ""}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Boxes className="h-7 w-7" />
            </span>
            <p className="mt-4 text-muted-foreground">{t.empty}</p>
          </div>
        )}
      </Container>
    </div>
  );
}
