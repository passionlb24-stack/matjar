import type { ReactNode } from "react";

// The one on/off toggle. Extracted from three hand-rolled copies
// (automation/automation-list-item, crm-manager, modules-manager) that had
// already drifted apart: two positioned the knob with `start-[22px]` and one
// with `end-0.5`; one drew the "off" track in bg-border and another in
// bg-surface-muted; and all three shipped a 44×24 control with no hit area
// around it and a knob you could barely see when off.
//
// Three rules the copies kept getting wrong, fixed here once:
//
// 1. RTL. The knob sits at the END of the track when on, so it is placed with
//    the logical `start`/`end` insets and never with a translate on a physical
//    axis. The browser resolves which physical side that is from the document
//    direction, so the same markup reads correctly in Arabic and English.
//
// 2. Touch target. The visible track is 44×24; a transparent `before` pseudo
//    (-inset-y-2.5 → 24 + 2×10 = 44) grows the *hit area* to 44×44 without
//    changing the layout — the same technique ui/button uses for size="sm".
//    Measuring the rendered box alone reports 24px and misses it.
//
// 3. Contrast (WCAG 1.4.11, 3:1 for a control that carries state). The old
//    off-track was --border, which put the white knob at 1.23:1 on light — the
//    knob was effectively invisible. --border-strong exists for exactly this
//    ("a control's boundary is its sole state cue"): white knob on it is 3.30:1
//    light / 4.59:1 dark, and on the primary on-track 6.68:1 / 3.20:1. The knob
//    is deliberately white in both themes: it is a physical object on a track,
//    not ink on a surface, so it does not follow --surface into the dark theme.

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  knob,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name. Required — a bare toggle has no visible text of its own. */
  label: string;
  disabled?: boolean;
  /** Optional glyph inside the knob (e.g. a lock on a plan-gated module). */
  knob?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] disabled:pointer-events-none disabled:opacity-55 ${
        checked ? "bg-primary" : "bg-border-strong"
      } ${className}`}
    >
      <span
        className={`absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-all ${
          checked ? "end-0.5" : "start-0.5"
        }`}
      >
        {knob}
      </span>
    </button>
  );
}
