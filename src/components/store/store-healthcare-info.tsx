import Link from "next/link";
import { CalendarCheck, ShieldCheck, Timer, Wallet } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { StoreView } from "@/lib/data/store-view";
import { formatUsd } from "@/lib/currency";

type ServiceLike = {
  price: number;
  durationMinutes?: number | null;
  attributes?: Record<string, string> | null;
};

/** The visit length the merchant actually recorded. The booking engine reads
 *  `products.duration_minutes`; the sector attribute form writes the same fact
 *  to `attributes.duration`, and today every live clinic service carries only
 *  the second. Reading both (column first) is how a number the merchant typed
 *  reaches the patient instead of being dropped for landing in the other
 *  field. Display only — it is never fed back into slot allocation. */
function serviceMinutes(s: ServiceLike): number | null {
  if (s.durationMinutes != null && s.durationMinutes > 0)
    return s.durationMinutes;
  const raw = s.attributes?.duration;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// What a patient needs before the calendar: what this practice treats, whether
// their insurance is taken, what a visit costs and how long it runs, and what
// happens if they have to cancel. Every line is merchant data — the specialties
// and insurance free-text, the real prices and durations of the services on
// offer, and the cancellation window the booking flow actually enforces. A
// clinic that filled in none of it renders no section at all.
export function StoreHealthcareInfo({
  store,
  services,
  cancelHours,
  canBook,
  dict,
}: {
  store: StoreView;
  services: ServiceLike[];
  /** stores.booking_cancel_hours — 0 means no window was set, so nothing is
   *  promised about cancelling. */
  cancelHours: number;
  canBook: boolean;
  dict: Dictionary;
}) {
  const priced = services.map((s) => s.price).filter((p) => p > 0);
  const priceFrom = priced.length ? Math.min(...priced) : null;
  const mins = services
    .map(serviceMinutes)
    .filter((m): m is number => m != null);
  const minLen = mins.length ? Math.min(...mins) : null;
  const maxLen = mins.length ? Math.max(...mins) : null;

  const facts: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (priceFrom != null)
    facts.push({
      icon: <Wallet className="h-4 w-4 text-primary" />,
      label: dict.store.from,
      value: formatUsd(priceFrom),
    });
  if (minLen != null && maxLen != null)
    facts.push({
      icon: <Timer className="h-4 w-4 text-primary" />,
      label: dict.store.visitLength,
      value:
        minLen === maxLen
          ? `${minLen} ${dict.os.hours.minutes}`
          : `${minLen}–${maxLen} ${dict.os.hours.minutes}`,
    });

  const showBookCta = canBook && services.length > 0;
  const hasAnything =
    !!store.specialties ||
    !!store.insurance ||
    facts.length > 0 ||
    cancelHours > 0;
  if (!hasAnything) return null;

  return (
    <section className="mt-8 grid gap-4 sm:grid-cols-2">
      {store.specialties && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-sm font-bold text-muted-foreground">
            {dict.store.specialtiesTitle}
          </h3>
          <p className="mt-1 font-medium">{store.specialties}</p>
        </div>
      )}
      {store.insurance && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="text-sm font-bold text-muted-foreground">
            {dict.store.insuranceTitle}
          </h3>
          <p className="mt-1 font-medium">{store.insurance}</p>
        </div>
      )}
      {(facts.length > 0 || cancelHours > 0) && (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:col-span-2">
          <h3 className="text-sm font-bold text-muted-foreground">
            {dict.offering.policiesTitle}
          </h3>
          {facts.length > 0 && (
            <dl className="mt-3 flex flex-wrap gap-2">
              {facts.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2 rounded-xl bg-surface-muted px-3.5 py-2"
                >
                  <span className="shrink-0">{f.icon}</span>
                  <dt className="text-xs font-bold text-muted-foreground">
                    {f.label}
                  </dt>
                  <dd className="text-sm font-bold tabular-nums" dir="ltr">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {cancelHours > 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {dict.offering.policyCancel.replace("{n}", String(cancelHours))}
            </p>
          )}
          {showBookCta && (
            <Link
              href="#offerings"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <CalendarCheck className="h-4 w-4" />
              {dict.booking.title}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
