import {
  BadgeCheck,
  Building2,
  ChevronDown,
  GraduationCap,
  PhoneCall,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { ProfessionalTrust } from "@/lib/professional";
import type { ProfessionalDict } from "./copy";

// Verification, as separate facts you can ask about.
//
// The thing this replaces is a single blue tick. A tick is unfalsifiable in the
// worst sense: nobody can tell whether it means "we saw his ID", "he paid us",
// or "he confirmed an SMS", so it earns exactly as much trust as the customer
// already had. Each fact here says WHICH check was done, and opening it says
// what the check actually was — so a badge is a claim the platform can be held
// to rather than a decoration.
//
// The disclosure is a native <details>. No JS, no state, no client boundary: it
// works in the first paint, it is keyboard- and screen-reader-correct for free,
// and a closed badge is an inline pill while an open one takes the full row
// (`open:w-full`) so the explanation is readable instead of squeezed into a
// chip-width column.
//
// `pro` is rendered BELOW a hairline, in the accent tone the app uses for
// "featured", and its explanation says in the first clause that it is a paid
// subscription. It must never sit inside the same row as the checked facts:
// merging them is precisely how a marketplace ends up selling a trust signal.

type Fact = {
  id: string;
  Icon: LucideIcon;
  label: string;
  why: string;
};

function TrustFact({
  fact,
  tone,
}: {
  fact: Fact;
  /** Token classes for the pill. Verified facts and Pro deliberately differ. */
  tone: string;
}) {
  // h-9 visible, +4px of transparent ::before top and bottom = a 44px hit area
  // (WCAG 2.5.5) without a row of fat pills. The 4px is deliberately less than
  // the row's 12px `gap-y-3`: at 6px the pseudo-elements of two wrapped rows
  // overlap and the neighbouring badge steals the tap — measured at 40px
  // effective height before this was tuned.
  return (
    <details className="group min-w-0 open:w-full">
      <summary
        className={`relative inline-flex h-9 max-w-full cursor-pointer list-none items-center gap-1.5 rounded-full px-3 text-xs font-bold before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] [&::-webkit-details-marker]:hidden ${tone}`}
      >
        <fact.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{fact.label}</span>
        <ChevronDown
          className="h-3 w-3 shrink-0 opacity-70 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <p className="mt-2 rounded-xl bg-surface-muted p-3 text-xs leading-relaxed text-muted-foreground">
        {fact.why}
      </p>
    </details>
  );
}

export function ProfessionalTrustBadges({
  trust,
  dict,
  hint = false,
  className = "",
}: {
  trust: ProfessionalTrust;
  dict: ProfessionalDict;
  /** Show the one-line "tap a badge" affordance line. Off inside cards. */
  hint?: boolean;
  className?: string;
}) {
  const t = dict.professional.trust;

  const facts: Fact[] = [
    trust.identityVerified && {
      id: "identity",
      Icon: BadgeCheck,
      label: t.identity,
      why: t.identityWhy,
    },
    trust.credentialVerified && {
      id: "credential",
      Icon: GraduationCap,
      label: t.credential,
      why: t.credentialWhy,
    },
    trust.businessRegistered && {
      id: "business",
      Icon: Building2,
      label: t.business,
      why: t.businessWhy,
    },
    trust.phoneVerified && {
      id: "phone",
      Icon: PhoneCall,
      label: t.phone,
      why: t.phoneWhy,
    },
  ].filter((f): f is Fact => Boolean(f));

  // Nothing checked and nothing paid for: render nothing at all. An empty
  // "unverified" row is a verdict the platform has not earned the right to
  // pass — every professional on this platform is unverified today.
  if (!facts.length && !trust.pro) return null;

  return (
    <div className={className}>
      {facts.length > 0 && (
        <>
          <div className="flex flex-wrap items-start gap-x-2 gap-y-3">
            {facts.map((f) => (
              <TrustFact
                key={f.id}
                fact={f}
                tone="bg-success-soft text-success"
              />
            ))}
          </div>
          {hint && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{t.hint}</p>
          )}
        </>
      )}

      {trust.pro && (
        <div
          className={
            facts.length > 0 ? "mt-3 border-t border-border pt-3" : undefined
          }
        >
          <TrustFact
            fact={{
              id: "pro",
              Icon: Sparkles,
              label: t.pro,
              why: t.proWhy,
            }}
            tone="bg-accent-soft text-accent-foreground"
          />
        </div>
      )}
    </div>
  );
}
