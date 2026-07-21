import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock, ArrowLeft, GraduationCap } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import {
  ACADEMY_CATEGORIES,
  CATEGORY_STYLE,
  GUIDES,
  guidesByCategory,
  type Guide,
} from "@/content/academy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.hub.academy.title,
    description: dict.hub.academy.subtitle,
    alternates: localeAlternates(lang, "/hub/academy"),
  };
}

export default async function AcademyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const a = dict.hub.academy;
  const en = lang === "en";
  const featured = GUIDES[0];
  const fs = CATEGORY_STYLE[featured.category];
  const readLabel = (g: Guide) => a.readMin.replace("{n}", String(g.readMin));

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

        {/* Hero */}
        <div className="mt-5">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <GraduationCap className="h-4 w-4" />
            {a.eyebrow}
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">{a.title}</h1>
          <p className="mt-4 max-w-xl text-muted-foreground sm:text-lg">{a.subtitle}</p>
        </div>

        {/* Featured guide */}
        <Link
          href={`/${lang}/hub/academy/${featured.slug}`}
          className={`group mt-10 grid gap-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-bl ${fs.grad} to-transparent p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[auto_1fr] sm:items-center sm:p-9`}
        >
          <span className={`grid h-20 w-20 place-items-center rounded-3xl text-4xl shadow-sm ${fs.tint}`}>
            {featured.emoji}
          </span>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
              <span className={fs.text}>{a.featured}</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-muted-foreground">{a.categories[featured.category]}</span>
            </div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight transition-colors group-hover:text-primary sm:text-3xl">
              {en ? featured.titleEn : featured.title}
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">{featured.excerpt}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
              {a.read}
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1 rtl:rotate-180" />
            </span>
          </div>
        </Link>

        {/* Category sections */}
        <div className="mt-14 space-y-12">
          {ACADEMY_CATEGORIES.map((cat) => {
            const guides = guidesByCategory(cat).filter((g) => g.slug !== featured.slug);
            if (!guides.length) return null;
            const s = CATEGORY_STYLE[cat];
            return (
              <section key={cat}>
                <div className="mb-5 flex items-center gap-2.5">
                  <span className={`h-5 w-1.5 rounded-full ${s.bar}`} />
                  <h2 className="text-lg font-extrabold tracking-tight">{a.categories[cat]}</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {guides.map((g) => (
                    <Link
                      key={g.slug}
                      href={`/${lang}/hub/academy/${g.slug}`}
                      className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <span className={`grid h-12 w-12 place-items-center rounded-xl text-2xl ${s.tint}`}>
                        {g.emoji}
                      </span>
                      <h3 className="mt-4 font-bold leading-snug transition-colors group-hover:text-primary">
                        {en ? g.titleEn : g.title}
                      </h3>
                      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{g.excerpt}</p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {readLabel(g)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
