import { BadgeCheck, CornerDownLeft, Star } from "lucide-react";

import type { Locale } from "@/i18n/config";
import { hasRating, type ProfessionalReview } from "@/lib/professional";
import { fill, plural, type ProfessionalDict } from "./copy";

// Reviews, and the two distinctions that make them worth reading.
//
// 1. A review attached to a job completed ON Matjar is a different kind of
//    claim from a review someone left after meeting the professional off
//    platform. Both are shown; only the first carries the badge, and the badge
//    says which one it is rather than "verified" on its own.
// 2. The professional's reply is theirs, not the platform's and not the
//    customer's — so it is indented under the review, attributed by name, and
//    never merged into the review body.
//
// The header average goes through `hasRating`. Zero reviews renders nothing at
// all: no "0.0", no empty star row, no "be the first to review" box. Today that
// is every professional on the platform.

/** Beirut, always — a review timestamp read in UTC is off by a day at night. */
function reviewDate(iso: string, lang: Locale): string {
  return new Date(iso).toLocaleDateString(
    // `ar-LB` alone renders Eastern Arabic numerals, which read wrong in a
    // commerce context here; `-u-nu-latn` keeps the Levantine month names
    // (آذار, not مارس) with Western digits.
    lang === "ar" ? "ar-LB-u-nu-latn" : "en",
    { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Beirut" },
  );
}

function Stars({ rating }: { rating: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${
            n <= rounded ? "fill-accent text-accent" : "text-border"
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function ProfessionalReviews({
  reviews,
  dict,
  lang,
  ratingAvg,
  ratingCount = 0,
  name,
  title,
  id,
  className = "",
}: {
  reviews: ProfessionalReview[];
  dict: ProfessionalDict;
  lang: Locale;
  /** Aggregate, for the header. Absent → no header average. */
  ratingAvg?: number | null;
  ratingCount?: number;
  /** The professional's name, for attributing their reply. */
  name?: string | null;
  /** `null` suppresses the heading; omitted uses the dictionary's. */
  title?: string | null;
  id?: string;
  className?: string;
}) {
  if (!reviews.length) return null;

  const t = dict.professional.reviews;
  const heading = title === undefined ? t.title : title;
  const rated = hasRating({ ratingAvg, ratingCount });

  return (
    <section id={id} className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {heading && <h2 className="text-lg font-extrabold">{heading}</h2>}
        {rated && (
          <p className="flex items-center gap-2 text-sm">
            <Stars rating={ratingAvg ?? 0} />
            <span className="font-bold">
              {fill(t.average, "{rating}", {
                rating: (ratingAvg ?? 0).toFixed(1),
              })}
            </span>
            <span className="text-muted-foreground">
              {plural(
                dict.professional.plurals.reviews,
                ratingCount,
                "{count}",
              )}
            </span>
          </p>
        )}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        {reviews.map((r) => (
          <li key={r.id} className="p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Stars rating={r.rating} />
              {r.customerName && (
                <span dir="auto" className="text-sm font-bold">
                  {r.customerName}
                </span>
              )}
              <span
                dir="auto"
                className="text-xs text-muted-foreground"
              >
                {reviewDate(r.createdAt, lang)}
              </span>
              {/* Only a review tied to a completed Matjar job earns this. An
                  unverified review carries no counter-badge: "unverified" is
                  not a finding, it is the default. */}
              {r.verifiedJob && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success"
                  title={t.verifiedWhy}
                >
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                  {t.verified}
                </span>
              )}
            </div>

            {r.comment && (
              <p
                dir="auto"
                className="mt-2 text-sm leading-relaxed text-foreground"
              >
                {r.comment}
              </p>
            )}

            {/* UNREACHABLE TODAY for trades: `craft_reviews` has no reply
                column, so a tradesman cannot answer a review even though the
                type allows one and this renders it. That is a gap in the
                schema rather than in the UI — right of reply is the only
                defence a professional has against one unfair review — but
                until a migration adds the column, nothing can populate this
                and it has never rendered against real data. */}
            {r.reply && (
              <div className="mt-3 rounded-xl bg-surface-muted p-3 ms-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <CornerDownLeft
                    className="h-3.5 w-3.5 shrink-0 rtl:-scale-x-100"
                    aria-hidden="true"
                  />
                  <span dir="auto">
                    {name
                      ? fill(t.reply, "{name}", { name })
                      : t.replyShort}
                  </span>
                </p>
                <p dir="auto" className="mt-1 text-sm leading-relaxed">
                  {r.reply}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
