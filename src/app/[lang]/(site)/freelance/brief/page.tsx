/**
 * `/[lang]/freelance/brief` — the way out of an empty search.
 *
 * An empty result page that only says "لا نتيجة" ends the session; the buyer
 * still wants the job done, they just could not find it by browsing. This is
 * the route the empty state and the "no results" panel lead to.
 *
 * **There is no project-brief backend.** `craft_requests` (0239) is the trades'
 * request table — status enum, provider inbox, lifecycle — and there is no
 * freelance equivalent anywhere in `supabase/migrations`. Rather than invent a
 * fake queue, this composes the brief and delivers it through the messaging
 * that already exists. The full accounting of what that costs is in the header
 * of `src/components/freelance/project-brief-form.tsx`; nothing here writes to
 * a table, changes RLS, or touches money.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Send } from "lucide-react";

import { ChevronPrev } from "@/components/ui/directional-icon";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { dictSlice } from "@/lib/dict-slice";
import { createClient } from "@/lib/supabase/server";
import { GIG_CATEGORIES } from "@/lib/gigs";
import { regions } from "@/lib/catalog";
import {
  groupGigsByPerson,
  regionLabel,
  type BrowsedGigRow,
} from "@/lib/data/freelance";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  ProjectBriefForm,
  type BriefRecipient,
} from "@/components/freelance/project-brief-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.freelance.brief.title,
    description: dict.freelance.brief.subtitle,
    // A form with a filter-shaped query string is an infinite crawl surface and
    // has nothing to rank for. Followed, not indexed.
    robots: { index: false, follow: true },
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FreelanceBriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ cat?: string; region?: string; to?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { cat, region, to } = await searchParams;
  const dict = await getDictionary(lang);
  const t = dict.freelance;

  const category = GIG_CATEGORIES.includes(cat as (typeof GIG_CATEGORIES)[number])
    ? (cat as string)
    : null;
  const regionKey = regions.some((r) => r.key === region) ? (region as string) : null;

  const supabase = await createClient();
  const [{ data: gigData }, { data: auth }] = await Promise.all([
    supabase.rpc("browse_gigs", {
      p_category: category,
      p_region: regionKey,
    }),
    supabase.auth.getUser(),
  ]);

  // The shortlist is people, not adverts: three gigs from one freelancer is one
  // person to write to, not three.
  const people = groupGigsByPerson((gigData ?? []) as unknown as BrowsedGigRow[]);
  const me = auth?.user?.id ?? null;

  const catLabel = (c: string) =>
    t.categories[c as keyof typeof t.categories] ?? c;

  const recipients: BriefRecipient[] = people
    // You cannot brief yourself — start_conversation raises on it, so filtering
    // here is what stops the owner meeting an error instead of an explanation.
    .filter((p) => p.id !== me)
    .map((p) => ({
      id: p.id,
      name: p.name || t.freelancer,
      avatarUrl: p.avatarUrl,
      verified: p.verified,
      categoryLabels: p.categories.map(catLabel),
    }));

  const href = (next: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      cat: category ?? undefined,
      region: regionKey ?? undefined,
      to: to && UUID_RE.test(to) ? to : undefined,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return `/${lang}/freelance/brief${s ? `?${s}` : ""}`;
  };

  const chip = (active: boolean) =>
    `inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border text-muted-foreground hover:border-primary/40"
    }`;

  return (
    <div className="py-10">
      <Container className="max-w-2xl">
        <Link
          href={`/${lang}/freelance`}
          className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronPrev className="h-4 w-4" />
          {t.title}
        </Link>
        <PageHeader
          className="mt-1"
          title={t.brief.title}
          subtitle={t.brief.subtitle}
          icon={Send}
        />

        {/* Narrowing the shortlist. Same params, same wording and same chip as
            the discovery page, so arriving here from a filtered search keeps the
            filter visible rather than silently dropping it. */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Link href={href({ cat: undefined })} className={chip(!category)}>
              {t.brief.anyCategory}
            </Link>
            {GIG_CATEGORIES.map((c) => (
              <Link
                key={c}
                href={href({ cat: category === c ? undefined : c })}
                className={chip(category === c)}
              >
                {catLabel(c)}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={href({ region: undefined })} className={chip(!regionKey)}>
              {t.brief.anyRegion}
            </Link>
            {regions.map((r) => (
              <Link
                key={r.key}
                href={href({ region: regionKey === r.key ? undefined : r.key })}
                className={chip(regionKey === r.key)}
              >
                {r.name[lang as Locale]}
              </Link>
            ))}
          </div>
        </div>

        <Card className="mt-6 p-5 sm:p-6">
          <ProjectBriefForm
            lang={lang as Locale}
            dict={dictSlice(dict, ["freelance", "common"])}
            recipients={recipients}
            preselect={to && UUID_RE.test(to) ? to : null}
            context={{
              categoryLabel: category ? catLabel(category) : null,
              regionLabel: regionLabel(regionKey, lang as Locale),
            }}
            signedIn={Boolean(me)}
          />
        </Card>
      </Container>
    </div>
  );
}
