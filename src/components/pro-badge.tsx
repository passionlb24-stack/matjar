import { Crown } from "lucide-react";

export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
      <Crown className="h-3 w-3" />
      Pro
    </span>
  );
}
