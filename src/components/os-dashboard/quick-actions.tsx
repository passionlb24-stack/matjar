import {
  ClipboardList,
  ChefHat,
  PackagePlus,
  Calculator,
  Megaphone,
  CalendarCheck,
  FileText,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

// ===== OS dashboard — QuickActions =====
// The 2-3 things this sector does twenty times a day, one tap from the top of
// the dashboard. The page picks the set per sector (and filters by staff
// permissions); this renders them as a compact ButtonLink row.

export type QuickActionKey =
  | "orders"
  | "kitchen"
  | "addItem"
  | "pos"
  | "campaign"
  | "bookings"
  | "requests";

export type QuickAction = {
  key: QuickActionKey;
  label: string;
  href: string;
};

const KEY_ICON: Record<QuickActionKey, typeof ClipboardList> = {
  orders: ClipboardList,
  kitchen: ChefHat,
  addItem: PackagePlus,
  pos: Calculator,
  campaign: Megaphone,
  bookings: CalendarCheck,
  requests: FileText,
};

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => {
        const Icon = KEY_ICON[a.key];
        return (
          <ButtonLink
            key={a.key}
            href={a.href}
            variant="secondary"
            size="sm"
            leftIcon={<Icon className="h-4 w-4 text-primary" />}
          >
            {a.label}
          </ButtonLink>
        );
      })}
    </div>
  );
}
