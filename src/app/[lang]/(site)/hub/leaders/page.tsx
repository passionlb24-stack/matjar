import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Users, MapPin, Crown } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { LeaderSubmit } from "@/components/hub/leader-submit";
import { LEADER_CARD_COLUMNS, type LeaderCard } from "@/lib/leaders";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.hub.leaders.title,
    description: dict.hub.leaders.subtitle,
    alternates: localeAlternates(lang, "/hub/leaders"),
  };
}

export default async function LeadersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const l = dict.hub.leaders;

  const supabase = await createClient();
  const { data } = await supabase
    .from("business_leaders")
    .select(LEADER_CARD_COLUMNS)
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  const leaders = (data ?? []) as LeaderCard[];

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <Link
          href={`/${lang}/hub`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.hub.backToHub}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{l.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{l.subtitle}</p>

        {leaders.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {leaders.map((p) => {
              const name = lang === "en" ? p.name_en || p.name : p.name;
              return (
                <Link
                  key={p.id}
                  href={`/${lang}/hub/leaders/${p.slug}`}
                  className="group overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative h-24 bg-gradient-to-bl from-primary/15 via-transparent to-transparent">
                    {p.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.cover_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="px-5 pb-5">
                    <div className="-mt-8 mb-3 h-16 w-16 overflow-hidden rounded-full ring-4 ring-surface">
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-surface-muted text-muted-foreground">
                          <Crown className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold transition-colors group-hover:text-primary">{name}</h3>
                    {p.headline && <p className="mt-0.5 text-sm text-muted-foreground">{p.headline}</p>}
                    {p.location && (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {p.location}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface-muted/30 py-16 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted-foreground">
              <Users className="h-7 w-7" />
            </span>
            <p className="mt-4 font-bold">{l.emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{l.emptyNote}</p>
          </div>
        )}

        <div className="mt-14 border-t border-border pt-10">
          <LeaderSubmit lang={lang} dict={dict} />
        </div>
      </Container>
    </div>
  );
}
