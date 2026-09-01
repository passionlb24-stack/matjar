import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, Sparkles, Star, User } from "lucide-react";

import type { Locale } from "@/i18n/config";
import { Money } from "@/components/ui/money";
import { NEUTRAL_BLUR } from "@/lib/image-placeholder";
import {
  hasRating,
  startingPrice,
  type ProfessionalKind,
  type ProfessionalProfile,
} from "@/lib/professional";
import { fill, listSep, plural, type ProfessionalDict } from "./copy";

// One professional, as a result.
//
// The two kinds are not a colour change. A customer scanning trades is asking
// "can I let this person into my house, and do they come to my area" — so the
// trade card leads with the person, and coverage is on it. A customer scanning
// freelance is asking "is this person any good" — and for a designer the work
// IS the credential, so that card leads with the work and the person follows.
// Same data, same component, two readings; `kind` picks which.
//
// Everything below the name is conditional. A profile with a name and three
// services renders as: initials, name, "from $x". No stars, no distance, no
// response time, no "usually replies within an hour" — none of which this
// platform measures, and every one of which is a card-filler that would be
// invented rather than known.
//
// ===== Putting these in a grid: name the mobile column count =====
//
//   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
//
// NOT `grid gap-4 sm:grid-cols-2`. Below `sm` that leaves the implicit track at
// `auto` = max-content, and this card's max-content is its FULL untruncated
// name — measured at 544px of content inside a 360px viewport, i.e. a page that
// scrolls sideways. `grid-cols-1` makes the track `minmax(0, 1fr)`. The card's
// own `min-w-0` covers a flex parent but cannot rescue a content-sized track.

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

function Avatar({
  profile,
  size,
}: {
  profile: ProfessionalProfile;
  size: "sm" | "lg";
}) {
  const box = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const radius = size === "lg" ? "rounded-xl" : "rounded-full";
  const px = size === "lg" ? 56 : 40;
  if (profile.photoUrl) {
    return (
      <Image
        src={profile.photoUrl}
        alt=""
        width={px}
        height={px}
        sizes={`${px}px`}
        className={`${box} ${radius} shrink-0 object-cover`}
      />
    );
  }
  return (
    <span
      className={`${box} ${radius} grid shrink-0 place-items-center bg-primary-soft text-xs font-extrabold text-primary`}
    >
      {initials(profile.name) || <User className="h-5 w-5" />}
    </span>
  );
}

/** Rating, only where a real review is behind it. */
function Rating({
  profile,
  dict,
}: {
  profile: ProfessionalProfile;
  dict: ProfessionalDict;
}) {
  if (!hasRating(profile)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-foreground">
      <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
      <span dir="ltr" className="tabular-nums">
        {(profile.ratingAvg ?? 0).toFixed(1)}
      </span>
      <span className="font-normal text-muted-foreground">
        {plural(
          dict.professional.plurals.reviews,
          profile.ratingCount,
          "{count}",
        )}
      </span>
    </span>
  );
}

function FromPrice({
  profile,
  dict,
}: {
  profile: ProfessionalProfile;
  dict: ProfessionalDict;
}) {
  const from = startingPrice(profile.services);
  // Every service quoted after a visit → no number exists. Rendering "$0" or a
  // dash here would both be worse than the silence.
  if (from == null) return null;
  return (
    <span className="shrink-0 text-end">
      <span className="block text-[11px] font-semibold text-muted-foreground">
        {dict.professional.card.from}
      </span>
      <span className="block text-base font-extrabold">
        <Money value={from} />
      </span>
    </span>
  );
}

export function ProfessionalCard({
  profile,
  href,
  dict,
  lang,
  kind,
  className = "",
}: {
  profile: ProfessionalProfile;
  href: string;
  dict: ProfessionalDict;
  lang: Locale;
  /** Which reading to render. Defaults to the profile's own kind. */
  kind?: ProfessionalKind;
  className?: string;
}) {
  const t = dict.professional;
  const reading = kind ?? profile.kind;
  // Static marks, not the <details> badges: a card is one link, and a
  // disclosure control nested inside an anchor is invalid and untappable.
  const verified = Boolean(
    profile.trust.identityVerified ||
      profile.trust.credentialVerified ||
      profile.trust.businessRegistered,
  );
  const subtitle = profile.headline || profile.specialties[0] || null;
  const cover = profile.portfolio[0];

  if (reading === "freelance") {
    // Evidence first. With no portfolio there is no cover — the card becomes
    // the compact row rather than growing a grey rectangle to fill the space.
    return (
      <Link
        href={href}
        className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${className}`}
      >
        {cover && (
          <div className="relative aspect-[16/10] overflow-hidden bg-surface-muted">
            <Image
              src={cover.imageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              placeholder="blur"
              blurDataURL={NEUTRAL_BLUR}
              className="object-cover"
            />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2.5">
            <Avatar profile={profile} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1">
                <span
                  dir="auto"
                  className="min-w-0 truncate text-sm font-bold group-hover:text-primary"
                >
                  {profile.name}
                </span>
                {verified && (
                  <BadgeCheck
                    className="h-4 w-4 shrink-0 text-success"
                    aria-label={t.trust.identity}
                  />
                )}
                {profile.trust.pro && (
                  <Sparkles
                    className="h-3.5 w-3.5 shrink-0 text-accent"
                    aria-label={t.trust.pro}
                  />
                )}
              </span>
              {subtitle && (
                <span
                  dir="auto"
                  className="block truncate text-xs text-muted-foreground"
                >
                  {subtitle}
                </span>
              )}
            </span>
          </div>

          {profile.skills.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {profile.skills.slice(0, 3).map((s) => (
                <span
                  key={s}
                  dir="auto"
                  className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                >
                  {s}
                </span>
              ))}
              {profile.skills.length > 3 && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {fill(t.card.more, "+{count}", {
                    count: profile.skills.length - 3,
                  })}
                </span>
              )}
            </span>
          )}

          <span className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-3">
            <Rating profile={profile} dict={dict} />
            <FromPrice profile={profile} dict={dict} />
          </span>
        </div>
      </Link>
    );
  }

  // The trade reading: the person, then whether they reach you.
  const areas = profile.area.areas;
  return (
    <Link
      href={href}
      className={`group flex min-w-0 gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs transition-colors hover:border-primary/50 ${className}`}
    >
      <Avatar profile={profile} size="lg" />

      <div className="min-w-0 flex-1">
        {/* `min-w-0` on BOTH the row and the truncating span. A flex item
            defaults to min-width:auto, so `truncate` (white-space:nowrap) on a
            long business name pushes the row past the card and takes the page's
            horizontal scrollbar with it — measured at 544px of content in a
            360px viewport before this was added. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span
            dir="auto"
            className="min-w-0 truncate font-bold group-hover:text-primary"
          >
            {profile.name}
          </span>
          {verified && (
            <BadgeCheck
              className="h-4 w-4 shrink-0 text-success"
              aria-label={t.trust.identity}
            />
          )}
          {profile.trust.pro && (
            <Sparkles
              className="h-3.5 w-3.5 shrink-0 text-accent"
              aria-label={t.trust.pro}
            />
          )}
        </div>

        {subtitle && (
          <p
            dir="auto"
            className="mt-0.5 truncate text-sm font-semibold text-muted-foreground"
          >
            {subtitle}
          </p>
        )}

        {(hasRating(profile) || (profile.yearsExperience ?? 0) > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Rating profile={profile} dict={dict} />
            {(profile.yearsExperience ?? 0) > 0 && (
              <span className="text-muted-foreground">
                {plural(
                  t.plurals.years,
                  profile.yearsExperience ?? 0,
                  "{count}",
                )}
              </span>
            )}
          </div>
        )}

        {(areas.length > 0 || profile.area.region) && (
          <p
            dir="auto"
            className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {areas.length
                ? areas.slice(0, 2).join(listSep(lang)) +
                  (areas.length > 2
                    ? listSep(lang) +
                      fill(t.card.more, "+{count}", {
                        count: areas.length - 2,
                      })
                    : "")
                : profile.area.region}
            </span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-end">
        <FromPrice profile={profile} dict={dict} />
      </div>
    </Link>
  );
}
