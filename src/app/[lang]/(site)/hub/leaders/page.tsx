import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Crown, MapPin, BadgeCheck, User, ArrowLeft } from "lucide-react";
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
    <div className="pb-16">
      <Container className="pt-10 sm:pt-14">
        <Link href={`/${lang}/hub`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {dict.hub.backToHub}
        </Link>

        {/* Gold hero */}
        <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-gradient-to-bl from-amber-500/12 via-transparent to-transparent p-8 sm:p-12">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            <Crown className="h-4 w-4" />
            {l.heroKicker}
          </span>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{l.title}</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground sm:text-lg">{l.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#submit" className="inline-flex h-11 items-center rounded-xl bg-amber-600 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700">{l.heroSubmit}</a>
            {leaders.length > 0 && (
              <a href="#directory" className="inline-flex h-11 items-center rounded-xl border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-primary/40">{l.heroBrowse}</a>
            )}
          </div>
        </div>

        {/* Directory or premium coming-soon */}
        {leaders.length > 0 ? (
          <div id="directory" className="mt-12 scroll-mt-24 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {leaders.map((p) => (
              <LeaderCardView key={p.id} p={p} lang={lang} l={l} />
            ))}
          </div>
        ) : (
          <div className="relative mt-12 overflow-hidden rounded-3xl border border-border bg-surface-muted/30">
            <div className="grid gap-5 p-6 blur-[3px] sm:grid-cols-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <SampleCard key={i} />
              ))}
            </div>
            <div className="absolute inset-0 grid place-items-center bg-background/60 p-6 text-center backdrop-blur-[1px]">
              <div className="max-w-md">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><Crown className="h-7 w-7" /></span>
                <span className="mt-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{l.comingBadge}</span>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight">{l.emptyTitle}</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{l.emptyNote}</p>
                <a href="#submit" className="mt-5 inline-flex h-11 items-center rounded-xl bg-amber-600 px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700">{l.submitButton}</a>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div id="submit" className="mt-16 scroll-mt-24">
          <LeaderSubmit lang={lang} dict={dict} />
        </div>
      </Container>
    </div>
  );
}

function LeaderCardView({ p, lang, l }: { p: LeaderCard; lang: string; l: Dictionaryish }) {
  const name = lang === "en" ? p.name_en || p.name : p.name;
  return (
    <Link
      href={`/${lang}/hub/leaders/${p.slug}`}
      className="group overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative h-20 bg-gradient-to-bl from-amber-500/15 to-primary/10">
        {p.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="px-5 pb-5">
        <div className="-mt-9 mb-3 h-16 w-16 overflow-hidden rounded-full ring-4 ring-surface">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo_url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-surface-muted text-muted-foreground"><User className="h-6 w-6" /></div>
          )}
        </div>
        <h3 className="flex items-center gap-1.5 font-bold transition-colors group-hover:text-primary">
          {name}
          <BadgeCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </h3>
        {p.headline && <p className="mt-0.5 text-sm font-semibold text-primary">{p.headline}</p>}
        {p.location && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {p.location}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400"><BadgeCheck className="h-3.5 w-3.5" /> {l.verified}</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">{l.viewProfile} <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /></span>
        </div>
      </div>
    </Link>
  );
}

type Dictionaryish = { verified: string; viewProfile: string };

function SampleCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface">
      <div className="h-20 bg-gradient-to-bl from-amber-500/15 to-primary/10" />
      <div className="px-5 pb-5">
        <div className="-mt-9 mb-3 grid h-16 w-16 place-items-center rounded-full bg-surface-muted text-muted-foreground ring-4 ring-surface"><User className="h-6 w-6" /></div>
        <div className="h-3.5 w-2/3 rounded bg-surface-muted" />
        <div className="mt-2 h-3 w-1/2 rounded bg-surface-muted/70" />
        <div className="mt-4 h-3 w-full rounded bg-surface-muted/50" />
      </div>
    </div>
  );
}
