import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, MapPin, Star, Wrench } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { CraftProvider } from "@/lib/data/crafts";

// One tradesman, as a card.
//
// Deliberately answers only the five questions a Lebanese customer actually
// asks before tapping: who, what trade, are they any good, do they come to my
// area, roughly what does it cost. Everything else belongs on the profile —
// a card carrying ten facts is a card nobody finishes reading.
//
// Not the freelancer card: no delivery days, no revisions, no skill tags. The
// two sections are meant to feel different, and this is where that starts.
export function CraftCard({
  provider,
  lang,
  labels,
}: {
  provider: CraftProvider;
  lang: Locale;
  labels: {
    from: string;
    verified: string;
    noRating: string;
    covers: string;
    works: string;
    years: string;
  };
}) {
  const ar = lang === "ar";
  const rating = Number(provider.rating_avg ?? 0);
  const count = provider.rating_count ?? 0;
  const trade = provider.trades[0];
  const areas = provider.service_areas;

  return (
    <Link
      href={`/${lang}/crafts/p/${provider.id}`}
      className="group flex gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
    >
      {provider.photo_url ? (
        <Image
          src={provider.photo_url}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
          sizes="56px"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Wrench className="h-6 w-6" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-bold group-hover:text-primary">
            {provider.name}
          </span>
          {/* Only a real, admin-reviewed document earns this. */}
          {provider.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success">
              <BadgeCheck className="h-3 w-3" />
              {labels.verified}
            </span>
          )}
        </div>

        {(provider.headline || trade) && (
          <p className="mt-0.5 truncate text-sm font-semibold text-muted-foreground">
            {trade?.icon} {provider.headline || (trade ? (ar ? trade.name_ar : trade.name_en) : "")}
            {provider.trades.length > 1 && (
              <span className="ms-1 font-normal">
                +{provider.trades.length - 1}
              </span>
            )}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {/* "No reviews yet" is not "bad" — never render it as a zero. */}
          {count > 0 ? (
            <span className="inline-flex items-center gap-1 font-bold text-warning">
              <Star className="h-3.5 w-3.5 fill-current" />
              {rating.toFixed(1)}
              <span className="font-normal text-muted-foreground">({count})</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{labels.noRating}</span>
          )}

          {(provider.years_experience ?? 0) > 0 && (
            <span className="text-muted-foreground">
              {provider.years_experience} {labels.years}
            </span>
          )}

          {(provider.works_count ?? 0) > 0 && (
            <span className="text-muted-foreground">
              {provider.works_count} {labels.works}
            </span>
          )}

          {provider.from_price != null && (
            <span className="font-bold text-primary">
              {labels.from} ${provider.from_price}
            </span>
          )}
        </div>

        {/* Coverage, not address. The question is "do you come to me?" */}
        {areas.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-1">
              <span className="font-semibold">{labels.covers}</span>{" "}
              {areas
                .slice(0, 3)
                .map((a) => (ar ? a.name_ar : a.name_en))
                .join("، ")}
              {areas.length > 3 && ` +${areas.length - 3}`}
            </span>
          </p>
        )}
      </div>
    </Link>
  );
}
