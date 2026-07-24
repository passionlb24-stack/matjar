import type { LucideIcon } from "lucide-react";

// Vertical flow step: a colored node on a connective rail + its content.
export function FlowStep({
  Icon,
  nodeClass,
  label,
  hint,
  last,
  children,
}: {
  Icon: LucideIcon;
  nodeClass: string;
  label: string;
  hint: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-3 sm:gap-4">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${nodeClass}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "pb-1" : "pb-6"}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-extrabold">{label}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <div className="mt-2.5">{children}</div>
      </div>
    </div>
  );
}
