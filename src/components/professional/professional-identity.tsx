import Image from "next/image";
import { MapPin, Star, User } from "lucide-react";

import type { Locale } from "@/i18n/config";
import { hasRating, type ProfessionalProfile } from "@/lib/professional";
import { ProfessionalTrustBadges } from "./professional-trust-badges";
import { listSep, plural, type ProfessionalDict } from "./copy";

// The top of a profile: who this is, what they do, what has been checked about
// them, and whether they come to your area.
//
// Everything below the name is conditional, and on the platform as it exists
// today almost all of it is absent — the one freelancer has a name and nothing
// else. So the sparse rendering is the designed one: a photo placeholder, a
// name, and white space. It reads as a new profile, not a broken page, because
// there is no row of dashes, no "0.0 ★", no "لسا بلا تقييم" box and no empty
// area line waiting to be filled.
//
// The rating in particular goes through `hasRating`, never through
// `ratingAvg ?? 0`: a 0 rendered as a star row is the platform inventing a
// verdict about somebody nobody has reviewed.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("");
}

/** One line of coverage — never an address. See ServiceArea in lib/professional. */
function areaLine(
  area: ProfessionalProfile["area"],
  lang: Locale,
  remoteLabel: string,
): string | null {
  const parts: string[] = [];
  if (area.areas.length) {
    parts.push(area.areas.slice(0, 3).join(listSep(lang)));
    if (area.areas.length > 3) parts.push(`+${area.areas.length - 3}`);
  } else if (area.region) {
    parts.push(area.region);
  }
  if (area.remote) parts.push(remoteLabel);
  return parts.length ? parts.join(listSep(lang)) : null;
}

export function ProfessionalIdentity({
  profile,
  dict,
  lang,
  titleAs = "h1",
  className = "",
}: {
  profile: ProfessionalProfile;
  dict: ProfessionalDict;
  lang: Locale;
  /** `h2` when the page already owns its `h1`. */
  titleAs?: "h1" | "h2";
  className?: string;
}) {
  const t = dict.professional;
  const Title = titleAs;
  const rated = hasRating(profile);
  const area = areaLine(profile.area, lang, t.area.remote);
  const years = profile.yearsExperience ?? 0;
  const completed = profile.completedCount ?? 0;

  return (
    <header className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-start gap-4">
        {profile.photoUrl ? (
          <Image
            src={profile.photoUrl}
            alt=""
            width={80}
            height={80}
            sizes="80px"
            className="h-16 w-16 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-20"
          />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary-soft text-lg font-extrabold text-primary sm:h-20 sm:w-20">
            {initials(profile.name) || <User className="h-7 w-7" />}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <Title
            dir="auto"
            className="text-xl font-extrabold leading-tight sm:text-2xl"
          >
            {profile.name}
          </Title>

          {profile.headline && (
            <p
              dir="auto"
              className="mt-1 text-sm font-semibold text-muted-foreground"
            >
              {profile.headline}
            </p>
          )}

          {(rated || years > 0 || completed > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {rated && (
                <span className="inline-flex items-center gap-1 font-bold text-accent-foreground">
                  <Star
                    className="h-3.5 w-3.5 fill-accent text-accent"
                    aria-hidden="true"
                  />
                  <span dir="ltr" className="tabular-nums">
                    {(profile.ratingAvg ?? 0).toFixed(1)}
                  </span>
                  <span className="font-normal text-muted-foreground">
                    {plural(t.plurals.reviews, profile.ratingCount, "{count}")}
                  </span>
                </span>
              )}
              {years > 0 && (
                <span className="text-muted-foreground">
                  {plural(t.plurals.years, years, "{count}")}
                </span>
              )}
              {completed > 0 && (
                <span className="text-muted-foreground">
                  {plural(t.plurals.jobs, completed, "{count}")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {profile.specialties.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {profile.specialties.map((s) => (
            <li
              key={s}
              dir="auto"
              className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted-foreground"
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      <ProfessionalTrustBadges trust={profile.trust} dict={dict} hint />

      {area && (
        <p
          dir="auto"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{area}</span>
        </p>
      )}
    </header>
  );
}
