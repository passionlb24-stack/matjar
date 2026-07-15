import type { LucideIcon } from "lucide-react";
import {
  UtensilsCrossed,
  ShoppingBag,
  Wrench,
  Stethoscope,
  Building2,
  Car,
  ClipboardList,
  CalendarCheck,
  Package,
  Users,
  BarChart3,
  Wallet,
  Ticket,
  UserCog,
  CreditCard,
  Settings,
  Pencil,
  ListTodo,
  Boxes,
  Calculator,
} from "lucide-react";
import type { CategoryKey } from "./catalog";
import { categoryModule } from "./modules";

// ===== Matjar Business OS — Sector Registry =====
// One core platform, many sectors. Each business type is *configuration*, not
// code: which OS modules it gets, in what order, with what vocabulary and what
// visual identity. Adding a sector (or later, toggling modules per plan) means
// editing this file only — pages render from the registry.

export type OsModuleKey =
  | "orders"
  | "bookings"
  | "items"
  | "doctors"
  | "customers"
  | "staff"
  | "tasks"
  | "inventory"
  | "pos"
  | "reports"
  | "accounting"
  | "coupons"
  | "subscription"
  | "settings"
  | "edit";

export type OsGroupKey = "daily" | "people" | "money" | "store";

// Ordered groups of the OS home. Sector configs list module keys per group;
// rendering keeps this order so every dashboard feels familiar while showing
// only what that business actually needs.
export const OS_GROUPS: OsGroupKey[] = ["daily", "people", "money", "store"];

export const OS_MODULE_META: Record<
  OsModuleKey,
  { Icon: LucideIcon; path: string; ownerOnly?: boolean; perm?: "orders" | "bookings" | "products" }
> = {
  orders: { Icon: ClipboardList, path: "orders", perm: "orders" },
  bookings: { Icon: CalendarCheck, path: "bookings", perm: "bookings" },
  items: { Icon: Package, path: "items", perm: "products" },
  doctors: { Icon: Stethoscope, path: "doctors", perm: "bookings" },
  customers: { Icon: Users, path: "customers", perm: "orders" },
  staff: { Icon: UserCog, path: "staff", ownerOnly: true },
  tasks: { Icon: ListTodo, path: "tasks" },
  inventory: { Icon: Boxes, path: "inventory", perm: "products" },
  pos: { Icon: Calculator, path: "pos", perm: "orders" },
  reports: { Icon: BarChart3, path: "reports", perm: "orders" },
  accounting: { Icon: Wallet, path: "accounting", perm: "orders" },
  coupons: { Icon: Ticket, path: "coupons", ownerOnly: true },
  subscription: { Icon: CreditCard, path: "subscription", ownerOnly: true },
  settings: { Icon: Settings, path: "settings", ownerOnly: true },
  edit: { Icon: Pencil, path: "edit", ownerOnly: true },
};

export type SectorConfig = {
  /** Sector identity icon (hero, empty states). */
  Icon: LucideIcon;
  /** Tailwind classes tinting the OS-home hero per sector. */
  heroTint: string;
  /** Tailwind classes for the sector icon badge. */
  iconTint: string;
  /** dict.os.nouns.* key — what this sector calls its customers. */
  customersNoun: "customers" | "patients" | "clients" | "leads";
  /** OS modules per group, in display order. */
  modules: Record<OsGroupKey, OsModuleKey[]>;
};

const MONEY: OsModuleKey[] = ["accounting", "reports", "coupons", "subscription"];
const STORE: OsModuleKey[] = ["edit", "settings"];

export const sectorConfig: Record<CategoryKey, SectorConfig> = {
  food: {
    Icon: UtensilsCrossed,
    heroTint: "from-orange-500/15 via-amber-400/10 to-transparent",
    iconTint: "bg-orange-100 text-orange-600",
    customersNoun: "customers",
    modules: {
      daily: ["orders", "pos", "items", "inventory", "tasks"],
      people: ["customers", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  retail: {
    Icon: ShoppingBag,
    heroTint: "from-primary/15 via-sky-400/10 to-transparent",
    iconTint: "bg-primary-soft text-primary",
    customersNoun: "customers",
    modules: {
      daily: ["orders", "pos", "items", "inventory", "tasks"],
      people: ["customers", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  services: {
    Icon: Wrench,
    heroTint: "from-violet-500/15 via-fuchsia-400/10 to-transparent",
    iconTint: "bg-violet-100 text-violet-600",
    customersNoun: "clients",
    modules: {
      daily: ["bookings", "items", "tasks"],
      people: ["customers", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  healthcare: {
    Icon: Stethoscope,
    heroTint: "from-emerald-500/15 via-teal-400/10 to-transparent",
    iconTint: "bg-emerald-100 text-emerald-600",
    customersNoun: "patients",
    modules: {
      daily: ["bookings", "doctors", "items", "tasks"],
      people: ["customers", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  realEstate: {
    Icon: Building2,
    heroTint: "from-amber-500/15 via-yellow-400/10 to-transparent",
    iconTint: "bg-amber-100 text-amber-700",
    customersNoun: "leads",
    modules: {
      daily: ["bookings", "items", "tasks"],
      people: ["customers", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  automotive: {
    Icon: Car,
    heroTint: "from-slate-500/15 via-zinc-400/10 to-transparent",
    iconTint: "bg-slate-200 text-slate-700",
    customersNoun: "leads",
    modules: {
      daily: ["orders", "items", "tasks"],
      people: ["customers", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
};

/** Convenience: full sector config + legacy flow config in one lookup. */
export function getSector(category: CategoryKey) {
  return { ...sectorConfig[category], flow: categoryModule[category] };
}
