import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";

// ===== OS dashboard — WidgetCard =====
// The shared shell every dashboard widget lives in: soft border, rounded-2xl,
// muted title row with an optional "view all" action. Content decides its own
// density — the shell only guarantees the family resemblance.

export function WidgetCard({
  title,
  Icon,
  action,
  children,
  className = "",
}: {
  title: string;
  Icon?: LucideIcon;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
          {Icon && <Icon className="h-4 w-4" />}
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-primary transition-colors hover:text-primary-hover"
          >
            {action.label}
            <ChevronLeft className="h-3.5 w-3.5 ltr:rotate-180" />
          </Link>
        )}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}
