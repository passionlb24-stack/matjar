// The freelancer card. One evidence slot, filled by lib/freelancer-trust —
// see that file for why it is not a rating row.
//
// Server component: nothing here needs state, and the whole card is one link, so
// shipping it as client JS would buy nothing.

import Link from "next/link";
import Image from "next/image";
import { Image as ImageIcon, BadgeCheck } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatUsd, formatLbp } from "@/lib/currency";
import { trustChips, type TrustChip } from "@/lib/freelancer-trust";

export type BrowsedGig = {
  id: string;
  title: string;
  category: string | null;
  price: number | null;
  delivery_days: number | null;
  revisions: number | null;
  image_url: string | null;
  gallery: string[] | null;
  region: string | null;
  available_until: string | null;
  completed_count: number | null;
  rating_avg: number | null;
  rating_count: number | null;
  freelancer_name: string | null;
  freelancer_avatar: string | null;
  freelancer_verified: boolean | null;
};

function initials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  return parts.slice(0, 2).map((p) => p[0]).join("");
}

// A missing key returns the fallback rather than undefined. A dictionary that
// is briefly out of step with the code — a new key, a stale cache — must not
// take the page down with it; the shopper should lose a word, not the listing.
function fill(
  template: string | undefined,
  fallback: string,
  vars: Record<string, string | number> = {},
): string {
  return Object.entries(vars).reduce(
    (out, [k, v]) => out.replace(`{${k}}`, String(v)),
    template ?? fallback,
  );
}

function chipLabel(
  chip: TrustChip,
  t: Record<string, string> | undefined,
  regionLabels: Record<string, string>,
): string {
  const s = t ?? {};
  switch (chip.kind) {
    case "rating":
      return fill(s.rating, "★ {rating} · {count}", {
        rating: chip.rating.toFixed(1),
        count: chip.count,
      });
    case "completed":
      return fill(s.completed, "{count}", { count: chip.count });
    case "available":
      return s.available ?? "✓";
    case "delivery":
      return fill(s.delivery, "{days}d", { days: chip.days });
    case "revisions":
      return fill(s.revisions, "{count}×", { count: chip.count });
    case "samples":
      return fill(s.samples, "{count}", { count: chip.count });
    case "region":
      return regionLabels[chip.region] ?? chip.region;
  }
}

// Earned evidence is tinted; declared evidence stays neutral. The shopper should
// be able to tell a verdict from a promise without reading the words.
function chipTone(chip: TrustChip): string {
  if (chip.kind === "rating" || chip.kind === "completed")
    return "bg-primary-soft text-primary";
  if (chip.kind === "available") return "bg-success-soft text-success";
  return "bg-surface-muted text-muted-foreground";
}

export function GigCard({
  gig,
  lang,
  dict,
  todayIso,
  lbpRate,
  regionLabels = {},
}: {
  gig: BrowsedGig;
  lang: Locale;
  dict: Dictionary;
  /** Passed in so the server and the client agree on what "today" is. */
  todayIso: string;
  lbpRate: number;
  regionLabels?: Record<string, string>;
}) {
  const t = dict.freelance;
  const trustT = t.trust as unknown as Record<string, string> | undefined;
  const chips = trustChips(
    {
      ratingAvg: gig.rating_avg,
      ratingCount: gig.rating_count,
      completedCount: gig.completed_count,
      availableUntil: gig.available_until,
      deliveryDays: gig.delivery_days,
      revisions: gig.revisions,
      gallery: gig.gallery,
      region: gig.region,
    },
    todayIso,
  );

  const samples = gig.gallery?.length ?? 0;
  const name = gig.freelancer_name ?? "";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none">
      <div className="relative h-40 overflow-hidden bg-surface-muted">
        {gig.image_url ? (
          <Image
            src={gig.image_url}
            alt={gig.title}
            width={400}
            height={260}
            className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center">
            <ImageIcon className="h-9 w-9 text-foreground/10" />
          </div>
        )}
        {/* The portfolio is the strongest thing a new freelancer has; say how
            deep it goes before the shopper has to open the page to find out. */}
        {samples > 1 && (
          <span className="absolute bottom-2 start-2 rounded-full bg-foreground/70 px-2 py-0.5 text-[11px] font-bold text-surface backdrop-blur-sm">
            {fill(trustT?.samples, "{count}", { count: samples })}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center gap-2.5">
          {gig.freelancer_avatar ? (
            <Image
              src={gig.freelancer_avatar}
              alt={name}
              width={34}
              height={34}
              className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-border bg-primary-soft text-xs font-extrabold text-primary">
              {initials(name)}
            </span>
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-sm font-bold">
              <span className="truncate">{name}</span>
              {gig.freelancer_verified && (
                <BadgeCheck
                  className="h-4 w-4 shrink-0 text-primary"
                  aria-label={t.verifiedTitle}
                />
              )}
            </span>
            {gig.category && (
              <span className="block text-xs text-muted-foreground">
                {t.categories[gig.category as keyof typeof t.categories] ??
                  gig.category}
              </span>
            )}
          </span>
        </div>

        <h2 className="line-clamp-2 text-[0.95rem] font-bold leading-snug transition-colors group-hover:text-primary">
          {gig.title}
        </h2>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c, i) => (
              <span
                key={`${c.kind}-${i}`}
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${chipTone(c)}`}
              >
                {chipLabel(c, trustT, regionLabels)}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-3">
          <span>
            {gig.price != null ? (
              <>
                <span className="block text-[11px] font-semibold text-muted-foreground">
                  {t.from}
                </span>
                <span className="block text-lg font-extrabold tabular-nums">
                  {formatUsd(Number(gig.price))}
                </span>
                {lbpRate > 0 && (
                  <span className="block text-[11px] text-muted-foreground">
                    {formatLbp(Number(gig.price), lbpRate, lang)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">—</span>
            )}
          </span>
          {/* Names the outcome. "View details" promises nothing; a Lebanese
              buyer hires over chat, and this is the step they are looking for. */}
          <span className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors group-hover:bg-primary-hover">
            {t.contactShort}
          </span>
        </div>
      </div>

      <Link
        href={`/${lang}/freelance/${gig.id}`}
        aria-label={gig.title}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
    </article>
  );
}
