import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// The standard dashboard page top. Replaces the per-page h1 + subtitle +
// action-buttons rows repeated across merchant/admin pages. Icon gets the same
// soft-primary badge treatment as EmptyState, so page tops feel like one family.

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** End-side slot — usually one or two <Button>/<ButtonLink>. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
