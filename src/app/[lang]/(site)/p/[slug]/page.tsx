import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { localeAlternates } from "@/lib/site";
import { Container } from "@/components/ui/container";

type SitePage = {
  title: string;
  title_en: string | null;
  body: string | null;
  published: boolean;
};

async function getPublishedPage(slug: string): Promise<SitePage | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_pages")
    .select("title, title_en, body, published")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return (data as unknown as SitePage | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const page = await getPublishedPage(slug);
  if (!page) return {};
  const title = lang === "en" ? page.title_en || page.title : page.title;
  const description = (page.body ?? "").replace(/\s+/g, " ").trim().slice(0, 150);
  return {
    title,
    description,
    alternates: localeAlternates(lang, `/p/${slug}`),
  };
}

export default async function CustomPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const page = await getPublishedPage(slug);
  if (!page) notFound();

  const title = lang === "en" ? page.title_en || page.title : page.title;
  const paragraphs = (page.body ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-3xl">
        <h1 className="text-3xl font-extrabold leading-[1.2] tracking-tight sm:text-[2.4rem]">
          {title}
        </h1>
        <div className="mt-6 space-y-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed text-muted-foreground whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      </Container>
    </div>
  );
}
