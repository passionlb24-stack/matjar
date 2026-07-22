import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Check, Store, Utensils, Scissors, Stethoscope, Wrench, Building2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { BusinessOs } from "@/components/business-os";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const m = dict.merchantsPage;
  return { title: m.metaTitle, description: m.metaDesc, alternates: localeAlternates(lang, "/merchants") };
}

const SECTOR_ICONS: LucideIcon[] = [Utensils, Store, Scissors, Stethoscope, Wrench, Building2];

export default async function MerchantsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const m = dict.merchantsPage;
  const base = `/${lang}`;

  return (
    <div className="pb-16">
      {/* Hero */}
      <div className="border-b border-border bg-surface-muted/30">
        <Container className="py-14 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{m.heroKicker}</span>
            <h1 className="mt-4 text-3xl font-extrabold leading-[1.14] tracking-tight sm:text-5xl">{m.heroTitle}</h1>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground sm:text-lg">{m.heroSub}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href={`${base}/merchant/new`} className="inline-flex h-12 items-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover">
                {dict.common.openStore}
              </Link>
              <Link href={`${base}/pricing`} className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-6 text-sm font-bold transition-colors hover:border-primary/40">
                {m.seePricing}
              </Link>
            </div>
          </div>
        </Container>
      </div>

      <Container>
        {/* Problem */}
        <div className="mx-auto mt-14 max-w-2xl rounded-3xl border border-border bg-surface p-7 text-center shadow-sm sm:p-9">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><AlertCircle className="h-6 w-6" /></span>
          <h2 className="mt-4 text-xl font-extrabold sm:text-2xl">{m.problemTitle}</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">{m.problemBody}</p>
        </div>
      </Container>

      {/* OS grid (reused band) */}
      <div className="mt-14">
        <BusinessOs lang={lang} dict={dict} />
      </div>

      <Container>
        {/* How it works */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">{m.howTitle}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {m.steps.map((s, i) => (
              <div key={i} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">{i + 1}</span>
                <h3 className="mt-4 font-bold">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sectors */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{m.sectorsTitle}</h2>
          <p className="mt-2 text-muted-foreground">{m.sectorsSub}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {m.sectors.map((s, i) => {
              const Icon = SECTOR_ICONS[i] ?? Store;
              return (
                <span key={i} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold shadow-sm">
                  <Icon className="h-4 w-4 text-primary" /> {s}
                </span>
              );
            })}
          </div>
        </div>

        {/* Trust */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">{m.trustTitle}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {m.trust.map((tr, i) => (
              <div key={i} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><Check className="h-5 w-5" /></span>
                <h3 className="mt-3 font-bold">{tr.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tr.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-16 overflow-hidden rounded-3xl border border-border bg-gradient-to-bl from-primary/10 to-transparent p-8 text-center sm:p-12">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{m.finalTitle}</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">{m.finalSub}</p>
          <Link href={`${base}/merchant/new`} className="mt-6 inline-flex h-12 items-center rounded-xl bg-primary px-8 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover">
            {dict.common.openStore}
          </Link>
        </div>
      </Container>
    </div>
  );
}
