import { Crown } from "lucide-react";

export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-foreground">
      <Crown className="h-3 w-3" />
      Pro
    </span>
  );
}
