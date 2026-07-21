import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";
import { ACADEMY_CATEGORIES, guidesByCategory } from "@/content/academy";

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
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{a.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{a.subtitle}</p>

        <div className="mt-10 space-y-12">
          {ACADEMY_CATEGORIES.map((cat) => {
            const guides = guidesByCategory(cat);
            if (!guides.length) return null;
            return (
              <section key={cat}>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  {a.categories[cat]}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {guides.map((g) => (
                    <Link
                      key={g.slug}
                      href={`/${lang}/hub/academy/${g.slug}`}
                      className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <span className="text-3xl">{g.emoji}</span>
                      <h3 className="mt-3 font-bold leading-snug transition-colors group-hover:text-primary">
                        {lang === "en" ? g.titleEn : g.title}
                      </h3>
                      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{g.excerpt}</p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {a.readMin.replace("{n}", String(g.readMin))}
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
