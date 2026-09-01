import { Clock, FileQuestion, RefreshCw, Truck } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import type { ProfessionalPrice, ProfessionalService } from "@/lib/professional";
import { fill, plural, type ProfessionalDict } from "./copy";

// The price list, honouring all six ways a price can honestly be expressed.
//
// The one that matters is `quote_required`. A marketplace that insists every
// row carries a number gets one of two lies: a made-up figure, or a "$0" that
// reads as free. An electrician cannot price a fault he has not seen, and the
// honest answer — "he prices it after he looks" — is a real answer, so it gets
// a real affordance: the row says so, and where the page has somewhere to send
// the customer (`quoteHref`) it offers the ask right there instead of leaving
// them to scroll back up hunting for a button.
//
// `visit_fee` is the other half of that: the call-out IS priced, the work is
// not. Showing only the call-out fee without the note would read as the price
// of the job, so the note is not decoration.
//
// `per_unit` is the dangerous one, and it fails in the opposite direction from
// every other mode here: it UNDERSTATES. "$12" for a painter who meant "$12 the
// square metre" is two orders of magnitude out on a hundred-metre job, and it
// is wrong in the direction the customer has no reason to question until the
// bill arrives. So one branch renders the amount and the unit together and
// there is no path through it that can produce the figure alone; a `per_unit`
// row whose `unit` is missing or blank is treated as UNPRICED instead — see
// `isUnpriced`. It is the same reason `startingPrice()` in lib/professional
// excludes the mode outright: there is no "from $12" to put on a card. That
// exclusion is deliberate and tested; nothing here routes around it.

/**
 * A row that cannot honestly show a number.
 *
 * Three ways in, and they collapse to the same customer-facing answer — you
 * get a price once he has looked at the job:
 *   · `quote_required`, which says so by definition;
 *   · any mode claiming an amount that is absent or ≤0 (absent is not zero);
 *   · `per_unit` with no unit. A rate with no unit is a number with no
 *     meaning, and the tradesman having typed a figure does not make it safe
 *     to print.
 */
function isUnpriced(price: ProfessionalPrice): boolean {
  if (price.mode === "quote_required") return true;
  if (price.amount == null || price.amount <= 0) return true;
  if (price.mode === "per_unit" && !(price.unit ?? "").trim()) return true;
  return false;
}

function ServicePrice({
  price,
  dict,
}: {
  price: ProfessionalPrice;
  dict: ProfessionalDict;
}) {
  const t = dict.professional.services;

  if (isUnpriced(price)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
        <FileQuestion className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t.quote}
      </span>
    );
  }

  // `isUnpriced` has already ruled out null and ≤0; this narrows the type.
  const amount = price.amount as number;

  // A rate. The unit is not conditional on anything inside this branch and it
  // sits in the same block as the figure, so the two cannot be separated by a
  // later edit. It stays OUTSIDE the <Money> isolate on purpose: the isolate
  // exists to pin the amount's own bidi ordering, and "متر مربّع" is Arabic
  // prose belonging to the surrounding paragraph.
  if (price.mode === "per_unit") {
    return (
      <span className="block">
        <span className="block text-base font-extrabold">
          <Money value={amount} />
          <span className="ms-1 text-xs font-semibold text-muted-foreground">
            {fill(t.perUnit, "/ {unit}", { unit: (price.unit ?? "").trim() })}
          </span>
        </span>
      </span>
    );
  }

  // UNREACHABLE TODAY — no table can produce it. `craft_services.pricing_type`
  // is CHECK-constrained to `fixed | from | hourly | per_meter | quote`, and
  // nothing else writes a price mode, so there is no column behind `visit_fee`
  // anywhere. The call-out fee is a real trade practice and the shape is right,
  // so the branch stays; but it is not a shipped feature until a migration adds
  // the column, and it has never rendered against real data.
  if (price.mode === "visit_fee") {
    return (
      <span className="block">
        <span className="block text-[11px] font-semibold text-muted-foreground">
          {t.visitFee}
        </span>
        <span className="block text-base font-extrabold">
          <Money value={amount} />
        </span>
      </span>
    );
  }

  return (
    <span className="block">
      {price.mode === "from" && (
        <span className="block text-[11px] font-semibold text-muted-foreground">
          {t.from}
        </span>
      )}
      <span className="block text-base font-extrabold">
        <Money value={amount} />
        {price.mode === "hourly" && (
          <span className="ms-1 text-xs font-semibold text-muted-foreground">
            {t.perHour}
          </span>
        )}
      </span>
    </span>
  );
}

export function ProfessionalServices({
  services,
  dict,
  quoteHref,
  title,
  id,
  className = "",
}: {
  services: ProfessionalService[];
  dict: ProfessionalDict;
  /** Where "ask for a quote" goes. Omitted → the row states the mode only. */
  quoteHref?: string;
  /** `null` suppresses the heading; omitted uses the dictionary's. */
  title?: string | null;
  id?: string;
  className?: string;
}) {
  // No services: no section. Not an empty card, not "prices coming soon".
  if (!services.length) return null;

  const t = dict.professional.services;
  const p = dict.professional.plurals;
  const heading = title === undefined ? t.title : title;
  // One predicate for the chip, the CTA and the footnote, so a unitless
  // `per_unit` row cannot render as unpriced while the note below the list
  // still claims every price on the page is a real one.
  const anyQuoted = services.some((s) => isUnpriced(s.price));

  return (
    <section id={id} className={className}>
      {heading && <h2 className="mb-3 text-lg font-extrabold">{heading}</h2>}

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        {services.map((s) => {
          const hasMeta = Boolean(
            s.price.durationMinutes || s.deliveryDays || s.revisions,
          );

          const quoted = isUnpriced(s.price);

          return (
            <li key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="font-bold">
                    {s.name}
                  </p>
                  {s.description && (
                    <p
                      dir="auto"
                      className="mt-1 text-sm leading-relaxed text-muted-foreground"
                    >
                      {s.description}
                    </p>
                  )}

                  {hasMeta && (
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {s.price.durationMinutes ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {plural(
                            p.minutes,
                            s.price.durationMinutes,
                            "{count}",
                          )}
                        </span>
                      ) : null}
                      {s.deliveryDays ? (
                        <span className="inline-flex items-center gap-1">
                          <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                          {plural(p.deliveryDays, s.deliveryDays, "{count}")}
                        </span>
                      ) : null}
                      {s.revisions ? (
                        <span className="inline-flex items-center gap-1">
                          <RefreshCw
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {plural(p.revisions, s.revisions, "{count}")}
                        </span>
                      ) : null}
                    </p>
                  )}

                  {s.includes && s.includes.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-bold text-muted-foreground">
                        {t.includes}
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs text-muted-foreground">
                        {s.includes.map((inc) => (
                          <li key={inc} dir="auto">
                            {inc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="max-w-[45%] shrink-0 text-end">
                  <ServicePrice price={s.price} dict={dict} />
                  {quoted && quoteHref && (
                    <ButtonLink
                      href={quoteHref}
                      variant="outline"
                      // `md` (44px) rather than `sm`: sm is 36px plus a 4px
                      // pseudo each side, which measures 43 after subpixel
                      // rounding. This is the block's primary affordance and
                      // it should not be one pixel short of the target size.
                      size="md"
                      className="mt-2"
                    >
                      {t.quoteCta}
                    </ButtonLink>
                  )}
                </div>
              </div>

              {s.price.mode === "visit_fee" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.visitFeeNote}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {anyQuoted && (
        <p className="mt-2 text-xs text-muted-foreground">{t.quoteNote}</p>
      )}
    </section>
  );
}
