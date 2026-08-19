import type { ComponentProps } from "react";

// The one card primitive. Replaces the ad-hoc `rounded-2xl border bg-surface
// shadow-* p-*` divs repeated across dashboards and listings. Use `interactive`
// for clickable cards (hover lift, mirrors button.tsx's motion language) and
// `elevated` for cards that must read above the page (modals, spotlights).

type CardVariant = "default" | "interactive" | "elevated";

const cardVariants: Record<CardVariant, string> = {
  default: "shadow-xs",
  interactive:
    "shadow-xs transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md",
  elevated: "shadow-md",
};

/** Elements a card is allowed to be. A dashboard widget is a labelled region
 *  (`section`), a review is an `article`, a row in a list is an `li` — the
 *  landmark matters to a screen reader, and forcing every card to be a `div`
 *  was pushing callers back to hand-rolling the class string just to keep their
 *  semantics. */
type CardElement = "div" | "section" | "article" | "li" | "aside";

export function Card({
  as = "div",
  variant = "default",
  className = "",
  ...props
}: { as?: CardElement; variant?: CardVariant } & ComponentProps<"div">) {
  // The props are typed against <div> and the tag is cast, rather than making
  // this generic over the element: every element in CardElement takes the same
  // props a caller actually passes here (className, id, aria-*, children), and
  // a fully generic version costs a page of conditional types to gain nothing.
  const Tag = as as "div";
  return (
    <Tag
      className={`rounded-2xl border border-border bg-surface ${cardVariants[variant]} ${className}`}
      {...props}
    />
  );
}

/** Title row: title on the start side, optional actions pushed to the end. */
export function CardHeader({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-5 pt-5 ${className}`}
      {...props}
    />
  );
}

export function CardTitle({ className = "", ...props }: ComponentProps<"h3">) {
  return <h3 className={`text-base font-bold ${className}`} {...props} />;
}

export function CardBody({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`p-5 ${className}`} {...props} />;
}

// ===== Lists =====
//
// A list of related rows — five bookings, nine reviews, the leads inbox — is
// ONE card with hairline separators, not N cards stacked with a gap. Giving
// every row its own border and shadow says "each of these is a separate,
// self-contained thing"; they are not, they are rows of one thing, and the
// stack of little boxes is what made a card stop meaning anything on this app.
//
// `overflow-hidden` is what lets the first and last rows sit flush inside the
// 2xl radius; the divider colour is --border, the same hairline the card's own
// outline uses, so the rows read as ruled lines rather than as internal edges.
//
// Rows are NOT interactive by default: use `interactive` on a row that is a
// whole-row link or button, which adds the hover fill and nothing else. A card
// still means "a discrete, actionable thing" — a row means "an entry in one".

export function CardList({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <Card
      className={`divide-y divide-border overflow-hidden ${className}`}
      {...props}
    />
  );
}

/** Same list, as a real <ul> — for rows that are semantically list items. */
export function CardListUl({ className = "", ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={`divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-xs ${className}`}
      {...props}
    />
  );
}

/** One row inside a CardList. `interactive` for whole-row links/buttons. */
export function CardRow({
  interactive = false,
  className = "",
  ...props
}: { interactive?: boolean } & ComponentProps<"div">) {
  return (
    <div
      className={`p-4 ${
        interactive ? "transition-colors hover:bg-surface-muted" : ""
      } ${className}`}
      {...props}
    />
  );
}
