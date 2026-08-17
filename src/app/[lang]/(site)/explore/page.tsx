import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates } from "@/lib/site";
import { discoveryParams } from "@/lib/discovery";
import {
  DiscoveryPage,
  resolveQuery,
  type RawSearchParams,
} from "@/components/discovery-page";
import { Container } from "@/components/ui/container";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const query = resolveQuery(await searchParams);

  const title = lang === "ar" ? "تصفّح المتاجر" : "Explore stores";
  const description =
    lang === "ar"
      ? "اكتشف كل المتاجر والخدمات في لبنان حسب المنطقة والتصنيف — بمكان واحد."
      : "Browse every store and service in Lebanon by region and category — all in one place.";

  // The canonical is the NORMALISED query string, not the one that arrived:
  // `?sort=recommended&page=1&utm_source=x` and `?region=narnia` all collapse to
  // the same address, so a filtered view has exactly one URL to rank.
  const alternates = localeAlternates(lang, "/explore");
  const qs = discoveryParams(query).toString();
  const suffix = qs ? `?${qs}` : "";

  return {
    title,
    description,
    alternates: {
      ...alternates,
      canonical: `${alternates.canonical}${suffix}`,
    },
    // A free-text search is unbounded crawl space — every typo is a new URL —
    // so those pages are followed but not indexed. The filter combinations,
    // which are finite and each describe a real slice of the marketplace, are.
    robots: query.q ? { index: false, follow: true } : undefined,
  };
}

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const query = resolveQuery(await searchParams);

  return (
    <div className="pb-16">
      <div className="border-b border-border bg-surface-muted/40">
        <Container className="py-8 text-center sm:py-12">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {dict.explore.title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground sm:text-lg">
            {dict.explore.subtitle}
          </p>
        </Container>
      </div>
      <DiscoveryPage
        lang={lang}
        dict={dict}
        base={`/${lang}/explore`}
        query={query}
      />
    </div>
  );
}
