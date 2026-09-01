import { Hammer } from "lucide-react";

import { plural, type ProfessionalDict } from "./copy";

// Years in the trade, and what those years were spent on.
//
// ===== The years line is a grammar problem, not a template =====
//
// Arabic inflects the noun by the number: سنة (1), سنتين (2), 3 سنوات (3–10),
// 11 سنة (11+). "{years} سنة" — one template with a digit dropped in — is
// therefore wrong for 1 through 10, and wrong in the way that tells a Lebanese
// reader the page was translated rather than written. The forms live in
// `professional.plurals.years` and are selected by `plural()` in ./copy.
//
// `null` for a null or zero `years`, matching `profileBlocks()`'s `experience`
// test. Zero years is not a fact about a professional, it is a field nobody
// filled in, and "0 سنة بالمهنة" on a page about a craftsman is the platform
// inventing an insult.
//
// `specialties` is optional and off by default: ProfessionalIdentity already
// renders the specialty chips at the top of a profile, so a page that uses both
// should leave this unset rather than print the same list twice. Pass it where
// this block stands alone — a dashboard, a compare view, a print sheet.

export function ProfessionalExperience({
  years,
  specialties,
  dict,
  title,
  id,
  className = "",
}: {
  years?: number | null;
  /** Trades/tools to list under the years. Omitted → not rendered. */
  specialties?: string[];
  dict: ProfessionalDict;
  /** `null` suppresses the heading; omitted uses the dictionary's. */
  title?: string | null;
  id?: string;
  className?: string;
}) {
  if (years == null || years <= 0) return null;

  const t = dict.professional;
  const heading = title === undefined ? t.experience.title : title;
  const list = specialties ?? [];

  return (
    <section id={id} className={className}>
      {heading && <h2 className="mb-3 text-lg font-extrabold">{heading}</h2>}

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
        <p className="flex items-center gap-2 font-bold">
          <Hammer className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {plural(t.plurals.years, years, "{count}")}
        </p>

        {list.length > 0 && (
          <>
            <p className="mt-3 text-xs font-bold text-muted-foreground">
              {t.experience.specialtiesLabel}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {list.map((s) => (
                <li
                  key={s}
                  dir="auto"
                  className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-bold text-muted-foreground"
                >
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
