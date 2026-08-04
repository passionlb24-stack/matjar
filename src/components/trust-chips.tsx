// The evidence row, shared by the card and the service page.
//
// What goes in it is decided by lib/freelancer-trust; this only renders it. One
// component so the two surfaces can never drift into claiming different things
// about the same freelancer — which is the fastest way to lose the trust the
// whole design is built to earn.

import type { Dictionary } from "@/i18n/get-dictionary";
import { trustChips, type TrustChip, type GigTrustInput } from "@/lib/freelancer-trust";

// A missing key falls back rather than returning undefined: a dictionary briefly
// out of step with the code should cost a word, not the page.
function fill(
  template: string | undefined,
  fallback: string,
  vars: Record<string, string | number> = {},
): string {
  return Object.entries(vars).reduce(
    (out, [k, v]) => out.replace(`{${k}}`, String(v)),
    template ?? fallback,
  );
}

export function chipLabel(
  chip: TrustChip,
  t: Record<string, string> | undefined,
  regionLabels: Record<string, string>,
): string {
  const s = t ?? {};
  switch (chip.kind) {
    case "rating":
      return fill(s.rating, "★ {rating} · {count}", {
        rating: chip.rating.toFixed(1),
        count: chip.count,
      });
    case "completed":
      return fill(s.completed, "{count}", { count: chip.count });
    case "available":
      return s.available ?? "✓";
    case "delivery":
      return fill(s.delivery, "{days}d", { days: chip.days });
    case "revisions":
      return fill(s.revisions, "{count}×", { count: chip.count });
    case "samples":
      return fill(s.samples, "{count}", { count: chip.count });
    case "region":
      return regionLabels[chip.region] ?? chip.region;
  }
}

// Earned evidence is tinted, declared evidence stays neutral — a shopper should
// tell a verdict from a promise without reading the words.
export function chipTone(chip: TrustChip): string {
  if (chip.kind === "rating" || chip.kind === "completed")
    return "bg-primary-soft text-primary";
  if (chip.kind === "available") return "bg-success-soft text-success";
  return "bg-surface-muted text-muted-foreground";
}

export function TrustChips({
  gig,
  dict,
  todayIso,
  regionLabels = {},
  max = 3,
  size = "sm",
}: {
  gig: GigTrustInput;
  dict: Dictionary;
  /** Passed in so server and client agree on what "today" is. */
  todayIso: string;
  regionLabels?: Record<string, string>;
  max?: number;
  size?: "sm" | "md";
}) {
  const t = dict.freelance.trust as unknown as Record<string, string> | undefined;
  const chips = trustChips(gig, todayIso, max);
  if (!chips.length) return null;

  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span
          key={`${c.kind}-${i}`}
          className={`rounded-full font-bold ${pad} ${chipTone(c)}`}
        >
          {chipLabel(c, t, regionLabels)}
        </span>
      ))}
    </div>
  );
}

export { fill };
