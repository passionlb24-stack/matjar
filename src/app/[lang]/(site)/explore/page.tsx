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
import { getDiscoveryCoverage } from "@/lib/data/discovery";
import { supportWaLink } from "@/lib/support";
import { Sprout, MessageCircle } from "lucide-react";

// ISS-026 — the cold-start line, and the rule that retires it.
//
// With fifteen live stores the directory reads as abandoned rather than new,
// and the platform says nothing either way. The fix is not a fabricated count,
// a fake "trending" rail or a wall of filler content — it is one paragraph that
// tells the truth the buyer is already suspecting, and gives them somewhere to
// put the thing they came for and did not find.
//
// It states no number. The reader can see how many stores there are; repeating
// it is either bragging or apologising, and the honest content is WHY the list
// is short — a reviewed, one-at-a-time roster — not how short.
//
// Below this many live stores the note appears, above it the note is wrong, so
// it deletes itself without anyone remembering to. Deliberately well clear of
// MIN_RAIL_ITEMS: a rail needs three to look deliberate, but a whole national
// directory needs considerably more before "early" stops being the true word.
const EARLY_UNTIL_STORES = 50;

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
  // Same cached read DiscoveryPage makes below — one round trip per ten
  // minutes platform-wide, shared, not two.
  const coverage = await getDiscoveryCoverage();
  const early = coverage.total > 0 && coverage.total < EARLY_UNTIL_STORES;

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
          {early && (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-border bg-surface p-5 text-start shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <Sprout className="h-4.5 w-4.5 shrink-0 text-success" />
                {dict.explore.earlyTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {dict.explore.earlyBody}
              </p>
              <a
                href={supportWaLink(dict.explore.earlyWaPrefill)}
                target="_blank"
                rel="noopener noreferrer"
                className="relative mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-whatsapp before:absolute before:-inset-x-3 before:-inset-y-3 before:content-['']"
              >
                <MessageCircle className="h-4 w-4" />
                {dict.explore.earlyCta}
              </a>
            </div>
          )}
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
