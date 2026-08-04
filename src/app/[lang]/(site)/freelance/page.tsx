import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sparkles, Plus } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getUsdLbpRate } from "@/lib/data/settings";
import { requestNow } from "@/lib/now";
import { GIG_CATEGORIES } from "@/lib/gigs";
import { regions } from "@/lib/catalog";
import { visibleFilters } from "@/lib/freelancer-trust";
import { GigCard, type BrowsedGig } from "@/components/gig-card";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.freelance.title,
    description: dict.freelance.subtitle,
  };
}

type Facets = {
  total?: number;
  verified?: number;
  available?: number;
  rated?: number;
  categories?: Record<string, number>;
  regions?: Record<string, number>;
};

export default async function FreelancePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ cat?: string; verified?: string; available?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { cat, verified, available } = await searchParams;
  const dict = await getDictionary(lang);
  const t = dict.freelance;

  const onlyVerified = verified === "1";
  const onlyAvailable = available === "1";

  const supabase = await createClient();

  // browse_gigs returns the whole card — the freelancer's name, photo and
  // verified flag included. profiles is own-row-only under RLS, so a plain
  // select could never reach them and a per-gig lookup would be N+1.
  const [{ data: gigData }, { data: facetData }, lbpRate] = await Promise.all([
    supabase.rpc("browse_gigs", {
      p_category: cat ?? null,
      p_verified_only: onlyVerified,
      p_available_only: onlyAvailable,
    }),
    supabase.rpc("gig_facets"),
    getUsdLbpRate(),
  ]);

  const gigs = (gigData ?? []) as unknown as BrowsedGig[];
  const facets = (facetData ?? {}) as Facets;

  // Only offer a filter that can actually split the list. A filter returning
  // nothing says more about the platform than about the query.
  const filters = visibleFilters(facets);
  const showCategories = filters.includes("category");
  const showVerified = filters.includes("verified");
  const showAvailable = filters.includes("available");

  // Beirut, not UTC — "available today" has to mean the merchant's today.
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Beirut",
  }).format(new Date(requestNow()));

  // Region names live in the catalogue, not the dictionary — one list, two langs.
  const regionLabels = Object.fromEntries(
    regions.map((r) => [r.key, r.name[lang as Locale]]),
  );

  const href = (next: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { cat, verified, available, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return `/${lang}/freelance${s ? `?${s}` : ""}`;
  };

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border text-muted-foreground hover:border-primary/40"
    }`;

  const filtered = Boolean(cat || onlyVerified || onlyAvailable);

  return (
    <div className="pb-16">
      <PageHero
        title={t.title}
        subtitle={t.subtitle}
        icon={Sparkles}
        actions={
          <ButtonLink
            href={`/${lang}/freelance/new`}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            {t.offerService}
          </ButtonLink>
        }
      />
      <Container className="py-8">
        {(showCategories || showVerified || showAvailable) && (
          <div className="flex flex-col gap-3">
            {showCategories && (
              <div className="flex flex-wrap gap-2">
                <Link href={href({ cat: undefined })} className={chip(!cat)}>
                  {t.allCategories}
                </Link>
                {GIG_CATEGORIES.filter((c) => (facets.categories ?? {})[c]).map(
                  (c) => (
                    <Link
                      key={c}
                      href={href({ cat: cat === c ? undefined : c })}
                      className={chip(cat === c)}
                    >
                      {t.categories[c]}
                    </Link>
                  ),
                )}
              </div>
            )}

            {(showVerified || showAvailable) && (
              <div className="flex flex-wrap gap-2">
                {showAvailable && (
                  <Link
                    href={href({ available: onlyAvailable ? undefined : "1" })}
                    className={chip(onlyAvailable)}
                  >
                    {t.filterAvailable}
                  </Link>
                )}
                {showVerified && (
                  <Link
                    href={href({ verified: onlyVerified ? undefined : "1" })}
                    className={chip(onlyVerified)}
                  >
                    {t.filterVerified}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {gigs.length ? (
          <div
            data-animate
            className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {gigs.map((g) => (
              <GigCard
                key={g.id}
                gig={g}
                lang={lang as Locale}
                dict={dict}
                todayIso={todayIso}
                lbpRate={lbpRate}
                regionLabels={regionLabels}
              />
            ))}
          </div>
        ) : filtered ? (
          // A dead end ends the session. Say the filter missed, and offer the
          // way back rather than an empty page.
          <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">{t.noResults}</p>
            <Link
              href={`/${lang}/freelance`}
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {t.filterAll}
            </Link>
          </div>
        ) : (
          <EmptyState
            className="mt-8"
            icon={Sparkles}
            title={t.empty}
            action={{ href: `/${lang}/freelance/new`, label: t.offerService }}
          />
        )}
      </Container>
    </div>
  );
}
