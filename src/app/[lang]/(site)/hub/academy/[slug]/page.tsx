import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock, ArrowLeft } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { GuideBody } from "@/components/hub/guide-body";
import { getGuide, CATEGORY_STYLE } from "@/content/academy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const g = getGuide(slug);
  if (!g) return {};
  return {
    title: lang === "en" ? g.titleEn : g.title,
    description: g.excerpt,
    alternates: localeAlternates(lang, `/hub/academy/${slug}`),
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const g = getGuide(slug);
  if (!g) notFound();
  const dict = await getDictionary(lang);
  const a = dict.hub.academy;
  const s = CATEGORY_STYLE[g.category];

  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-3xl">
        <Link
          href={`/${lang}/hub/academy`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          {a.title}
        </Link>

        {/* Premium cover header */}
        <header
          className={`mt-5 overflow-hidden rounded-3xl border border-border bg-gradient-to-bl ${s.grad} to-transparent`}
        >
          <div className="p-7 sm:p-10">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
              <span className={s.text}>{a.categories[g.category]}</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {a.readMin.replace("{n}", String(g.readMin))}
              </span>
            </div>
            <div className="mt-5 flex items-start gap-4">
              <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl shadow-sm ${s.tint}`}>
                {g.emoji}
              </span>
              <h1 className="pt-1 text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-[2.6rem]">
                {lang === "en" ? g.titleEn : g.title}
              </h1>
            </div>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{g.excerpt}</p>
          </div>
        </header>

        <GuideBody blocks={g.blocks} category={g.category} />

        {/* CTA */}
        <div className="mt-14 overflow-hidden rounded-3xl border border-primary/25 bg-primary-soft/40">
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-lg font-extrabold">{a.ctaTitle}</p>
            <p className="max-w-md text-sm text-muted-foreground">{a.ctaNote}</p>
            <Link
              href={`/${lang}/hub/tools`}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {a.ctaButton}
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
