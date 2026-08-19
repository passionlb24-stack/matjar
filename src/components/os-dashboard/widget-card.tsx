import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChevronNext } from "@/components/ui/directional-icon";

// ===== OS dashboard — WidgetCard =====
// The shared shell every dashboard widget lives in: a Card, plus a muted title
// row with an optional "view all" action. Content decides its own density — the
// shell only guarantees the family resemblance.
//
// The border/radius/surface/shadow used to be spelled out here as the same
// literal string ui/card.tsx defines, which is how the two drifted: this said
// shadow-xs and Card's `default` variant said shadow-xs, and nothing would have
// noticed if either had changed. It renders as a <section> because a dashboard
// widget is a labelled region of the page, not a generic box.

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
    <Card
      as="section"
      className={`flex h-full flex-col p-5 ${className}`}
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
            <ChevronNext className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </Card>
  );
}
