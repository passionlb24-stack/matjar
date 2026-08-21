import Link from "next/link";
import { AlertTriangle, Clock, type LucideIcon } from "lucide-react";

// ===== The empty state of a merchant tool =====
//
// Every OS module rendered the same thing at zero: a dashed box with one grey
// sentence in the middle of it. That box is the best piece of real estate in the
// dashboard — the merchant is looking straight at it and nothing on the screen
// is competing for their attention — and it was being spent on a status report.
//
// This one carries three things instead:
//
//   • the fact (unchanged: "no orders yet" is true and worth saying),
//   • WHY it is empty, which is different for a store in review, a store with an
//     empty catalogue and a live store nobody has visited,
//   • and the control that changes it, so the next step is a click and not a
//     memory test about which sidebar item to hunt for.
//
// Purely presentational. Everything it says is decided by the caller — see
// next-step-empty.tsx, which resolves the store's actual state.

export type EmptyAction = {
  key: string;
  href: string;
  label: string;
  Icon?: LucideIcon;
  /** Leaves the app (a wa.me share link) — a plain anchor, not a route. */
  external?: boolean;
};

// One button shape for both tiers; the palette is the only difference. Height
// is a real min-h-[44px] rather than the before:-inset trick — these are wide
// labelled buttons, so the box they draw is already the box a thumb hits.
function ActionButton({
  action,
  className,
}: {
  action: EmptyAction;
  className: string;
}) {
  const inner = (
    <>
      {action.Icon && <action.Icon className="h-4 w-4 shrink-0" aria-hidden />}
      {action.label}
    </>
  );
  const shape = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${className}`;
  return action.external ? (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      className={shape}
    >
      {inner}
    </a>
  ) : (
    <Link href={action.href} className={shape}>
      {inner}
    </Link>
  );
}

export function ModuleEmpty({
  Icon,
  title,
  body,
  /** A state the merchant cannot act on but must know about (review, stopped). */
  note,
  noteKind = "info",
  primary,
  secondary = [],
  /** Slot for a client control — the share button, mainly. */
  children,
  className,
}: {
  Icon?: LucideIcon;
  title: string;
  body?: string;
  note?: string;
  noteKind?: "info" | "warning" | "danger";
  primary?: EmptyAction;
  secondary?: EmptyAction[];
  children?: React.ReactNode;
  className?: string;
}) {
  const NoteIcon = noteKind === "danger" ? AlertTriangle : Clock;
  return (
    <div
      className={`rounded-2xl border border-dashed border-border px-5 py-10 text-center sm:py-12 ${className ?? ""}`}
    >
      {Icon && (
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="h-7 w-7" aria-hidden />
        </span>
      )}
      <p className={`font-bold ${Icon ? "mt-4" : ""}`}>{title}</p>
      {body && (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {body}
        </p>
      )}

      {note && (
        <p
          className={`mx-auto mt-3 flex max-w-md items-center justify-center gap-2 text-xs font-semibold sm:text-sm ${
            noteKind === "danger" ? "text-danger" : "text-warning"
          }`}
        >
          <NoteIcon className="h-4 w-4 shrink-0" aria-hidden />
          {note}
        </p>
      )}

      {(primary || secondary.length > 0 || children) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {primary && (
            <ActionButton
              action={primary}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            />
          )}
          {children}
          {secondary.map((a) => (
            <ActionButton
              key={a.key}
              action={a}
              className="border border-border bg-surface hover:border-primary hover:text-primary"
            />
          ))}
        </div>
      )}
    </div>
  );
}
