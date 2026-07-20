import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

// Full-width gradient hero band for consumer-facing listing pages (jobs,
// freelance, wholesale, market…). The V2 counterpart to the compact PageHeader
// used inside the dashboard — same props, bigger presence. Token-driven so it
// holds up in dark mode.
export function PageHero({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  /** End-side slot — usually one or two <Button>/<ButtonLink>. */
  actions?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/60 via-background to-background"
      />
      <Container className="py-10 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-4">
          <div className="flex min-w-0 items-center gap-4">
            {Icon && (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                <Icon className="h-7 w-7" />
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-xl text-muted-foreground sm:text-lg">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      </Container>
    </div>
  );
}
