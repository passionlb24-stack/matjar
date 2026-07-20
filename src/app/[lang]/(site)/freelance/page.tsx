import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Sparkles, Plus, Clock, ImageIcon } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates } from "@/lib/site";
import { GIG_CATEGORIES, type Gig } from "@/lib/gigs";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.freelance.title,
    description: dict.freelance.subtitle,
    alternates: localeAlternates(lang, "/freelance"),
  };
}

function money(n: number) {
  return n >= 1000 ? `$${Number(n).toLocaleString("en-US")}` : `$${n}`;
}

export default async function FreelancePage({
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
  const t = dict.freelance;

  const supabase = await createClient();
  let q = supabase
    .from("gigs")
    .select("id, title, category, price, delivery_days, image_url")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(100);
  if (cat) q = q.eq("category", cat);
  const { data } = await q;
  const gigs = (data ?? []) as Gig[];

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-primary bg-primary-soft text-primary"
        : "border-border text-muted-foreground hover:border-primary/40"
    }`;

  return (
    <div className="pb-16">
      <PageHero
        title={t.title}
        subtitle={t.subtitle}
        icon={Sparkles}
        actions={
          <ButtonLink
            href={`/${lang}/freelance/new`}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            {t.offerService}
          </ButtonLink>
        }
      />
      <Container className="py-8">
        <div className="flex flex-wrap gap-2">
          <Link href={`/${lang}/freelance`} className={chip(!cat)}>
            {t.allCategories}
          </Link>
          {GIG_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/${lang}/freelance?cat=${c}`}
              className={chip(cat === c)}
            >
              {t.categories[c]}
            </Link>
          ))}
        </div>

        {gigs.length ? (
          <div
            data-animate
            className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {gigs.map((g) => (
              <Card
                key={g.id}
                variant="interactive"
                className="group relative flex flex-col overflow-hidden"
              >
                <div className="relative overflow-hidden">
                  {g.image_url ? (
                    <Image
                      src={g.image_url}
                      alt={g.title}
                      width={300}
                      height={200}
                      className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center bg-surface-muted">
                      <ImageIcon className="h-9 w-9 text-foreground/10" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  {g.category && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t.categories[g.category as keyof typeof t.categories] ??
                        g.category}
                    </span>
                  )}
                  <h2 className="mt-0.5 line-clamp-2 text-sm font-bold leading-tight transition-colors group-hover:text-primary">
                    {g.title}
                  </h2>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    {g.price != null && (
                      <span className="text-sm font-extrabold text-primary">
                        {t.from} {money(Number(g.price))}
                      </span>
                    )}
                    {g.delivery_days != null && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {g.delivery_days}
                        {t.daysShort}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/${lang}/freelance/${g.id}`}
                  aria-label={g.title}
                  className="absolute inset-0 z-0"
                />
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-8"
            icon={Sparkles}
            title={t.empty}
            action={{ href: `/${lang}/freelance/new`, label: t.offerService }}
          />
        )}
      </Container>
    </div>
  );
}
