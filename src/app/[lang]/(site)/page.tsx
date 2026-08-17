import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { localeAlternates, SITE_URL } from "@/lib/site";
import { siteJsonLd, jsonLdScript } from "@/lib/jsonld";
import { Hero } from "@/components/hero";
import { WorldsShowcase } from "@/components/worlds-showcase";
import { FeaturedStores } from "@/components/featured-stores";
import { BestSellersTeaser } from "@/components/best-sellers-teaser";
import { ForYouStrip } from "@/components/for-you-strip";
import { HomeMore } from "@/components/home-more";
import { MerchantCta } from "@/components/merchant-cta";
import { SectionSkeleton } from "@/components/section-skeleton";
import { dictSlice } from "@/lib/dict-slice";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { alternates: localeAlternates(lang, "") };
}

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  // V2 answers one question, in order: what is this (hero + search) → what can
  // I browse (categories) → who is actually here (recommended, then real
  // stores) → what is moving (one highlight) → what else exists (compact) →
  // and only then, the merchant door.
  //
  // Phones and desktop read the same sequence now, so the CSS `order` shuffle
  // the previous pass needed is gone with the sections that made it necessary.
  // Everything the merchant-software pitch used to say on this page is on
  // /merchants; the FAQ is on /help; the region index is on /explore.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            siteJsonLd({
              siteUrl: SITE_URL,
              lang,
              name: dict.common.brand,
              description: dict.hero.subtitle,
            }),
          ),
        }}
      />

      <Hero lang={lang} dict={dict} />

      <WorldsShowcase lang={lang} dict={dict} />

      {/* Per-user recommendations. Client island: fetches its own data in the
          browser after load, so it adds no per-user server read and keeps this
          page cacheable. Renders nothing for anon / no-history users — which
          is why it can sit above the real-store rail without risking a gap. */}
      <ForYouStrip
        lang={lang}
        dict={dictSlice(dict, ["home", "catalog", "explore", "featured"])}
      />

      {/* Not "near you": only a minority of live stores have coordinates and
          nothing here sorts by distance. This is the real store list, labelled
          as exactly that. */}
      <Suspense fallback={<SectionSkeleton cards={4} />}>
        <FeaturedStores lang={lang} dict={dict} />
      </Suspense>

      {/* The one marketplace highlight. Best sellers is the only product rail
          backed by enough real rows to clear MIN_RAIL_ITEMS on a phone; offers
          and the restaurant rail currently hold one item each, which is a
          section that hides itself on the device most customers arrive on. */}
      <Suspense fallback={<SectionSkeleton cards={4} />}>
        <BestSellersTeaser lang={lang} dict={dict} />
      </Suspense>

      <HomeMore lang={lang} dict={dict} />

      <MerchantCta lang={lang} dict={dict} />
    </>
  );
}
