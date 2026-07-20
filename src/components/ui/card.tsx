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

export function Card({
  variant = "default",
  className = "",
  ...props
}: { variant?: CardVariant } & ComponentProps<"div">) {
  return (
    <div
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
