import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap, Crown, Sparkles } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { GUIDES } from "@/content/academy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.hub.title,
    description: dict.hub.subtitle,
    alternates: localeAlternates(lang, "/hub"),
  };
}

export default async function HubPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const h = dict.hub;

  return (
    <div className="py-12 sm:py-16">
      <Container>
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 sm:p-12">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-bl from-primary/10 via-transparent to-transparent" />
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-4 w-4" /> {h.eyebrow}
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
            {h.title}
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground sm:text-lg">{h.subtitle}</p>
        </div>

        {/* Two sections: Academy + Leaders */}
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {/* Academy */}
          <Link
            href={`/${lang}/hub/academy`}
            className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            <div className="bg-gradient-to-bl from-emerald-500/15 to-transparent p-8">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <GraduationCap className="h-7 w-7" />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight transition-colors group-hover:text-primary">
                {h.academyTitle}
              </h2>
              <p className="mt-2 text-muted-foreground">{h.academyNote}</p>
            </div>
            <div className="flex flex-1 flex-col justify-end p-8 pt-0">
              <div className="flex flex-wrap gap-2">
                {GUIDES.slice(0, 3).map((g) => (
                  <span
                    key={g.slug}
                    className="rounded-full border border-border bg-surface-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {g.emoji} {lang === "en" ? g.titleEn : g.title}
                  </span>
                ))}
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                {h.enterAcademy}
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1 rtl:rotate-180" />
              </span>
            </div>
          </Link>

          {/* Leaders */}
          <Link
            href={`/${lang}/hub/leaders`}
            className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          >
            <div className="bg-gradient-to-bl from-amber-500/15 to-transparent p-8">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                <Crown className="h-7 w-7" />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight transition-colors group-hover:text-primary">
                {h.leadersTitle}
              </h2>
              <p className="mt-2 text-muted-foreground">{h.leadersNote}</p>
            </div>
            <div className="flex flex-1 flex-col justify-end p-8 pt-0">
              <p className="text-sm leading-relaxed text-muted-foreground">{h.leadersTeaser}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                {h.enterLeaders}
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1 rtl:rotate-180" />
              </span>
            </div>
          </Link>
        </div>
      </Container>
    </div>
  );
}
