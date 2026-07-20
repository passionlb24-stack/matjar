import type { ComponentProps } from "react";

// The one status/label pill. Replaces the ad-hoc `rounded-full bg-*-soft
// text-* px-2 text-xs` spans scattered across order statuses, plan labels,
// stock states, etc. Soft tinted backgrounds come from the semantic tokens in
// globals.css (--success-soft & co.), so badges stay consistent app-wide.

type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";
type BadgeSize = "sm" | "md";

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

const badgeSizes: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({
  variant = "neutral",
  size = "md",
  className = "",
  ...props
}: { variant?: BadgeVariant; size?: BadgeSize } & ComponentProps<"span">) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold ${badgeVariants[variant]} ${badgeSizes[size]} ${className}`}
      {...props}
    />
  );
}
