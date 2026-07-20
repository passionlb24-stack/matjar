import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// The one place the app defines what a button looks like. Every variant carries
// the same premium base: rounded, bold, a subtle press (active:scale) and hover
// lift (shadow), a crisp focus ring (from globals), and disabled handling. Use
// <Button> for actions and <ButtonLink> for navigation so links and buttons stay
// visually identical.

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold whitespace-nowrap " +
  "transition-[transform,box-shadow,background-color,border-color,color] duration-150 " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md",
  secondary:
    "bg-surface text-foreground border border-border shadow-xs hover:border-primary/40 hover:shadow-sm",
  outline:
    "border border-primary/30 text-primary hover:bg-primary-soft/60 hover:border-primary/60",
  ghost: "text-foreground hover:bg-surface-muted",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  full = false,
}: {
  variant?: Variant;
  size?: Size;
  full?: boolean;
} = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""}`;
}

export function Button({
  variant = "primary",
  size = "md",
  full = false,
  loading = false,
  leftIcon,
  rightIcon,
  className = "",
  children,
  disabled,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
} & Omit<ComponentProps<"button">, "ref">) {
  return (
    <button
      className={`${buttonVariants({ variant, size, full })} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

// A Next.js Link styled exactly like a Button (for navigation).
export function ButtonLink({
  variant = "primary",
  size = "md",
  full = false,
  leftIcon,
  rightIcon,
  className = "",
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
} & ComponentProps<typeof Link>) {
  return (
    <Link
      className={`${buttonVariants({ variant, size, full })} ${className}`}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
