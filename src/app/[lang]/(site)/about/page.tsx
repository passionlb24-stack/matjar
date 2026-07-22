import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LayoutGrid, Store, Blocks, MapPin, Wallet, MessageCircle, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
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
    title: dict.footer.links.about,
    description: dict.aboutPage.body,
    alternates: localeAlternates(lang, "/about"),
  };
}

const OFFER_ICONS: LucideIcon[] = [LayoutGrid, Store, Blocks, MapPin, Wallet, MessageCircle];

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const a = dict.aboutPage;
  const base = `/${lang}`;

  return (
    <div className="pb-16">
      {/* Hero */}
      <div className="border-b border-border bg-surface-muted/30">
        <Container className="py-14 sm:py-18">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{a.kicker}</span>
            <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{a.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{a.body}</p>
          </div>
        </Container>
      </div>

      <Container className="max-w-4xl">
        {/* Story */}
        <section className="mt-14">
          <h2 className="text-2xl font-extrabold tracking-tight">{a.storyTitle}</h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-8 text-muted-foreground">{a.storyBody}</p>
        </section>

        {/* Mission + Vision */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface p-7 shadow-sm">
            <h3 className="text-lg font-extrabold text-primary">{a.missionTitle}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{a.missionBody}</p>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-7 shadow-sm">
            <h3 className="text-lg font-extrabold text-primary">{a.visionTitle}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{a.visionBody}</p>
          </div>
        </div>

        {/* Offer */}
        <section className="mt-14">
          <h2 className="text-2xl font-extrabold tracking-tight">{a.offerTitle}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {a.offer.map((o, i) => {
              const Icon = OFFER_ICONS[i] ?? Store;
              return (
                <div key={i} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" /></span>
                  <h3 className="mt-4 font-bold">{o.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{o.d}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Values */}
        <section className="mt-14">
          <h2 className="text-2xl font-extrabold tracking-tight">{a.valuesTitle}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {a.values.map((v, i) => (
              <div key={i} className="rounded-2xl border border-border bg-surface-muted/30 p-5">
                <span className="inline-flex items-center gap-1.5 font-bold"><Check className="h-4 w-4 text-primary" /> {v.t}</span>
                <p className="mt-1.5 text-sm text-muted-foreground">{v.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-14 overflow-hidden rounded-3xl border border-border bg-gradient-to-bl from-primary/10 to-transparent p-8 text-center sm:p-10">
          <h2 className="text-2xl font-extrabold tracking-tight">{a.ctaTitle}</h2>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href={`${base}/merchant/new`} className="inline-flex h-11 items-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover">{dict.common.openStore}</Link>
            <Link href={`${base}/explore`} className="inline-flex h-11 items-center rounded-xl border border-border bg-surface px-6 text-sm font-bold transition-colors hover:border-primary/40">{a.ctaBrowse}</Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
