import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Shared empty-state card. Matches the "gold standard" already used on the
// favorites page: a dashed-border card with an optional icon badge, a message,
// an optional secondary line, and an optional "what to do next" action.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-border py-16 text-center ${className ?? ""}`}
    >
      {Icon && (
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <p className={`text-muted-foreground ${Icon ? "mt-4" : ""}`}>{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
