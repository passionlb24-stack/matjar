import Link from "next/link";
import { Check, Circle } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { ChevronNext } from "@/components/ui/directional-icon";
import { completeness, type ProfessionalProfile } from "@/lib/professional";
import { fill, lookup, type ProfessionalDict } from "./copy";

// The coaching checklist — for the professional's own dashboard, and nowhere
// else.
//
// This is the one block on the platform that is allowed to talk about what is
// MISSING, because it is the only one whose reader can fix it. The same
// information on a public profile is a score of a person's paperwork shown to
// somebody deciding whether to hire them: the single freelancer on the platform
// today would render at roughly 1/8, which says nothing true about whether they
// are any good at their job. So there is no percentage badge here to lift onto
// a public page later, and the component takes the whole profile precisely
// because it is meant to be rendered where the profile is being edited.
//
// Unfinished steps come first, heaviest first, because the ordering IS the
// advice: `completeness()` weights the steps a customer actually decides on
// (photo, headline, services, trade, area) above the ones that only matter to
// the platform.

export function ProfessionalCompleteness({
  profile,
  dict,
  hrefs,
  className = "",
}: {
  profile: ProfessionalProfile;
  dict: ProfessionalDict;
  /** Where each step is fixed, keyed by step key. Missing keys are plain rows. */
  hrefs?: Partial<Record<string, string>>;
  className?: string;
}) {
  const t = dict.professional.completeness;
  const { steps, done, total } = completeness(profile);
  // `completeness()` already sorts by weight; this keeps that order within each
  // group and only moves the finished ones out of the way.
  const ordered = [...steps.filter((s) => !s.done), ...steps.filter((s) => s.done)];

  return (
    <section
      className={`rounded-2xl border border-border bg-surface p-5 shadow-xs ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-extrabold">{t.title}</h2>
        {/* No `dir="ltr"` here: the string is "3 من 8", not a number. Isolating
            it as LTR reorders the Arabic word against the digits and it renders
            as "من 3 8". Money gets the isolate (ui/money.tsx); a counted phrase
            does not. */}
        <span className="text-sm font-bold tabular-nums">
          {fill(t.progress, "{done}/{total}", { done, total })}
        </span>
      </div>

      <Progress
        value={(done / total) * 100}
        tone={done === total ? "success" : "primary"}
        label={t.title}
        className="mt-3"
      />

      <p className="mt-3 text-sm text-muted-foreground">
        {done === total ? t.allDone : t.subtitle}
      </p>

      <ul className="mt-4 divide-y divide-border">
        {ordered.map((step) => {
          const label = lookup(t.steps, step.key) ?? step.key;
          const hint = lookup(t.hints, step.key);
          const href = hrefs?.[step.key];

          const body = (
            <>
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                  step.done
                    ? "bg-success-soft text-success"
                    : "text-muted-foreground"
                }`}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Circle className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-bold ${
                    step.done ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {label}
                </span>
                {/* The hint is the coaching. It is dropped once the step is
                    done — telling someone why to do a thing they have done is
                    noise, and this list is read on a phone. */}
                {!step.done && hint && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {hint}
                  </span>
                )}
              </span>
              {href && !step.done && (
                <ChevronNext className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </>
          );

          return (
            <li key={step.key}>
              {href ? (
                <Link
                  href={href}
                  className="flex min-h-[var(--m-touch)] items-start gap-3 py-3 transition-colors hover:text-primary"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-start gap-3 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
