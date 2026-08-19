import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ProBadge() {
  return (
    <Badge variant="accent" size="sm">
      <Crown className="h-3 w-3" />
      Pro
    </Badge>
  );
}
