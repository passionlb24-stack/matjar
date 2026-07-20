import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Crown,
  ClipboardList,
  CircleCheck,
  ChevronLeft,
} from "lucide-react";
import { WidgetCard } from "./widget-card";

// ===== OS dashboard — AlertsCard =====
// Honest, actionable warnings only: trial ending, orders waiting, stock about
// to run out. Every row links to the place that fixes it. When there's
// nothing, say so proudly (all-clear) instead of hiding the card from owners.

export type AlertRow = {
  id: string;
  kind: "trial" | "orders" | "stock";
  text: string;
  cta: string;
  href: string;
};

const KIND_STYLE: Record<
  AlertRow["kind"],
  { Icon: typeof Boxes; chip: string }
> = {
  trial: { Icon: Crown, chip: "bg-warning-soft text-warning" },
  orders: { Icon: ClipboardList, chip: "bg-primary-soft text-primary" },
  stock: { Icon: Boxes, chip: "bg-danger-soft text-danger" },
};

export function AlertsCard({
  title,
  empty,
  alerts,
}: {
  title: string;
  empty: string;
  alerts: AlertRow[];
}) {
  return (
    <WidgetCard title={title} Icon={AlertTriangle}>
      {alerts.length ? (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const { Icon, chip } = KIND_STYLE[a.kind];
            return (
              <li key={a.id}>
                <Link
                  href={a.href}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${chip}`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                    {a.text}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-primary">
                    {a.cta}
                    <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-3 text-sm font-semibold text-success">
          <CircleCheck className="h-4.5 w-4.5 shrink-0" />
          {empty}
        </p>
      )}
    </WidgetCard>
  );
}
