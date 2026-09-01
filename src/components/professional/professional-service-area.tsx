import { Globe, MapPin, Navigation } from "lucide-react";

import type { ServiceArea } from "@/lib/professional";
import type { ProfessionalDict } from "./copy";

// Coverage. NEVER an address.
//
// A craftsman is usually one person working out of the place he lives, so an
// "address" field on this block would publish a private residence to anyone who
// opens the page — and the customer's question is not "where do you live", it is
// "do you come to me". `ServiceArea` in lib/professional is deliberately narrow
// (region, areas, on-site, remote) and this component renders exactly that and
// nothing more. If a future change adds a street to that type, it does not
// belong here.

export function ProfessionalServiceArea({
  area,
  dict,
  title,
  id,
  className = "",
}: {
  area: ServiceArea;
  dict: ProfessionalDict;
  /** `null` suppresses the heading; omitted uses the dictionary's. */
  title?: string | null;
  id?: string;
  className?: string;
}) {
  const hasAreas = area.areas.length > 0;
  // Nothing declared: no block. An empty coverage card answers the customer's
  // question with a shrug, which is worse than not raising it.
  if (!hasAreas && !area.region && !area.onSite && !area.remote) return null;

  const t = dict.professional.area;
  const heading = title === undefined ? t.title : title;

  return (
    <section id={id} className={className}>
      {heading && <h2 className="mb-3 text-lg font-extrabold">{heading}</h2>}

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
        {area.region && (
          <p
            dir="auto"
            className="flex items-center gap-1.5 text-sm font-bold"
          >
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            {area.region}
          </p>
        )}

        {hasAreas && (
          <ul className={`flex flex-wrap gap-2 ${area.region ? "mt-3" : ""}`}>
            {area.areas.map((a) => (
              <li
                key={a}
                dir="auto"
                className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-bold text-muted-foreground"
              >
                {a}
              </li>
            ))}
          </ul>
        )}

        {(area.onSite || area.remote) && (
          <ul
            className={`flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground ${
              hasAreas || area.region ? "mt-3" : ""
            }`}
          >
            {area.onSite && (
              <li className="flex items-center gap-1.5">
                <Navigation className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t.onSite}
              </li>
            )}
            {area.remote && (
              <li className="flex items-center gap-1.5">
                <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t.remote}
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
