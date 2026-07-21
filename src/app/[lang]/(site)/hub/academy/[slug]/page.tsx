import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { GuideBody } from "@/components/hub/guide-body";
import { getGuide } from "@/content/academy";

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

        <div className="mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          <span>{a.categories[g.category]}</span>
          <span className="text-muted-foreground">·</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {a.readMin.replace("{n}", String(g.readMin))}
          </span>
        </div>

        <h1 className="mt-3 flex items-start gap-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          <span className="text-4xl">{g.emoji}</span>
          <span>{lang === "en" ? g.titleEn : g.title}</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{g.excerpt}</p>

        <hr className="my-8 border-border" />

        <GuideBody blocks={g.blocks} />

        <div className="mt-12 rounded-2xl border border-border bg-surface-muted/40 p-6 text-center">
          <p className="font-bold">{a.ctaTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{a.ctaNote}</p>
          <Link
            href={`/${lang}/hub/tools`}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {a.ctaButton}
          </Link>
        </div>
      </Container>
    </div>
  );
}
