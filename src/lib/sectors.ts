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
  Handshake,
  ChefHat,
  FileText,
  MapPin,
  Zap,
  Megaphone,
  Scissors,
  Dumbbell,
  Trophy,
  GraduationCap,
  PartyPopper,
  BedDouble,
  Pill,
  PawPrint,
  Scale,
  HardHat,
  Sprout,
} from "lucide-react";
import type { CategoryKey } from "./catalog";
import { categoryModule } from "./modules";
import { type FeatureModuleKey, withDependencies } from "./modules-catalog";

// ===== Matjar Business OS — Sector Registry =====
// One core platform, many sectors. Each business type is *configuration*, not
// code: which OS modules it gets, in what order, with what vocabulary and what
// visual identity. Adding a sector (or later, toggling modules per plan) means
// editing this file only — pages render from the registry.

export type OsModuleKey =
  | "orders"
  | "bookings"
  | "requests"
  | "items"
  | "doctors"
  | "customers"
  | "campaigns"
  | "staff"
  | "automations"
  | "tasks"
  | "inventory"
  | "pos"
  | "suppliers"
  | "kitchen"
  | "reports"
  | "accounting"
  | "coupons"
  | "subscription"
  | "branches"
  | "settings"
  | "edit";

export type OsGroupKey = "daily" | "people" | "money" | "store";

// Ordered groups of the OS home. Sector configs list module keys per group;
// rendering keeps this order so every dashboard feels familiar while showing
// only what that business actually needs.
export const OS_GROUPS: OsGroupKey[] = ["daily", "people", "money", "store"];

export const OS_MODULE_META: Record<
  OsModuleKey,
  {
    Icon: LucideIcon;
    path: string;
    ownerOnly?: boolean;
    perm?: "orders" | "bookings" | "products";
    /** Requires the Pro plan (free stores see a lock + upsell). */
    pro?: boolean;
  }
> = {
  orders: { Icon: ClipboardList, path: "orders", perm: "orders" },
  bookings: { Icon: CalendarCheck, path: "bookings", perm: "bookings" },
  requests: { Icon: FileText, path: "requests", perm: "bookings" },
  items: { Icon: Package, path: "items", perm: "products" },
  doctors: { Icon: Stethoscope, path: "doctors", perm: "bookings", pro: true },
  customers: { Icon: Users, path: "customers", perm: "orders", pro: true },
  campaigns: { Icon: Megaphone, path: "campaigns", perm: "orders", pro: true },
  staff: { Icon: UserCog, path: "staff", ownerOnly: true, pro: true },
  automations: { Icon: Zap, path: "automations", perm: "orders", pro: true },
  tasks: { Icon: ListTodo, path: "tasks", pro: true },
  inventory: { Icon: Boxes, path: "inventory", perm: "products", pro: true },
  pos: { Icon: Calculator, path: "pos", perm: "orders", pro: true },
  suppliers: { Icon: Handshake, path: "suppliers", perm: "orders", pro: true },
  kitchen: { Icon: ChefHat, path: "kitchen", perm: "orders", pro: true },
  reports: { Icon: BarChart3, path: "reports", perm: "orders", pro: true },
  accounting: { Icon: Wallet, path: "accounting", perm: "orders", pro: true },
  coupons: { Icon: Ticket, path: "coupons", ownerOnly: true, pro: true },
  subscription: { Icon: CreditCard, path: "subscription", ownerOnly: true },
  branches: { Icon: MapPin, path: "branches", ownerOnly: true },
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
  /** Default feature-module bundle (see modules-catalog.ts). Drives the public
   *  profile, create form, and search filters — not just the dashboard. */
  features: FeatureModuleKey[];
  /** OS modules per group, in display order. */
  modules: Record<OsGroupKey, OsModuleKey[]>;
};

const MONEY: OsModuleKey[] = ["accounting", "reports", "coupons", "subscription"];
const STORE: OsModuleKey[] = ["branches", "edit", "settings"];
// Real estate has no goods suppliers; every other sector tracks supplier debts.
const MONEY_WITH_SUPPLIERS: OsModuleKey[] = [
  "accounting",
  "suppliers",
  "reports",
  "coupons",
  "subscription",
];

export const sectorConfig: Record<CategoryKey, SectorConfig> = {
  food: {
    Icon: UtensilsCrossed,
    features: ["menu", "orders", "delivery", "reservations", "reviews", "location", "media", "messaging"],
    heroTint: "from-orange-500/15 via-amber-400/10 to-transparent",
    iconTint: "bg-orange-100 text-orange-600",
    customersNoun: "customers",
    modules: {
      daily: ["orders", "kitchen", "pos", "items", "inventory", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  retail: {
    Icon: ShoppingBag,
    features: ["catalog", "orders", "inventory", "delivery", "reviews", "location", "marketing", "messaging", "media"],
    heroTint: "from-primary/15 via-sky-400/10 to-transparent",
    iconTint: "bg-primary-soft text-primary",
    customersNoun: "customers",
    modules: {
      daily: ["orders", "pos", "items", "inventory", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  services: {
    Icon: Wrench,
    features: ["requests", "portfolio", "reviews", "verifications", "location", "messaging", "media"],
    heroTint: "from-violet-500/15 via-fuchsia-400/10 to-transparent",
    iconTint: "bg-violet-100 text-violet-600",
    customersNoun: "clients",
    modules: {
      daily: ["requests", "bookings", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  healthcare: {
    Icon: Stethoscope,
    features: ["appointments", "team", "verifications", "reviews", "location", "messaging", "media"],
    heroTint: "from-emerald-500/15 via-teal-400/10 to-transparent",
    iconTint: "bg-emerald-100 text-emerald-600",
    customersNoun: "patients",
    modules: {
      daily: ["requests", "bookings", "doctors", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  realEstate: {
    Icon: Building2,
    features: ["listings", "appointments", "reviews", "location", "media", "messaging"],
    heroTint: "from-amber-500/15 via-yellow-400/10 to-transparent",
    iconTint: "bg-amber-100 text-amber-700",
    customersNoun: "leads",
    modules: {
      daily: ["bookings", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  automotive: {
    Icon: Car,
    features: ["listings", "requests", "rentals", "reviews", "location", "media", "messaging"],
    heroTint: "from-slate-500/15 via-zinc-400/10 to-transparent",
    iconTint: "bg-slate-200 text-slate-700",
    customersNoun: "leads",
    modules: {
      daily: ["orders", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  beauty: {
    Icon: Scissors,
    features: ["appointments", "catalog", "team", "reviews", "media", "location", "messaging"],
    heroTint: "from-pink-500/15 via-rose-400/10 to-transparent",
    iconTint: "bg-pink-100 text-pink-600",
    customersNoun: "clients",
    modules: {
      daily: ["bookings", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  fitness: {
    Icon: Dumbbell,
    features: ["memberships", "classes", "team", "reviews", "location", "media", "messaging"],
    heroTint: "from-lime-500/15 via-green-400/10 to-transparent",
    iconTint: "bg-lime-100 text-lime-700",
    customersNoun: "customers",
    modules: {
      daily: ["bookings", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  sportsCourts: {
    Icon: Trophy,
    features: ["timeslot", "memberships", "reviews", "location", "media", "messaging"],
    heroTint: "from-teal-500/15 via-cyan-400/10 to-transparent",
    iconTint: "bg-teal-100 text-teal-600",
    customersNoun: "customers",
    modules: {
      daily: ["bookings", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  education: {
    Icon: GraduationCap,
    features: ["courses", "team", "memberships", "reviews", "verifications", "messaging", "media"],
    heroTint: "from-indigo-500/15 via-blue-400/10 to-transparent",
    iconTint: "bg-indigo-100 text-indigo-600",
    customersNoun: "clients",
    modules: {
      daily: ["bookings", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  events: {
    Icon: PartyPopper,
    features: ["timeslot", "catalog", "media", "reviews", "location", "messaging"],
    heroTint: "from-fuchsia-500/15 via-purple-400/10 to-transparent",
    iconTint: "bg-fuchsia-100 text-fuchsia-600",
    customersNoun: "clients",
    modules: {
      daily: ["bookings", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  hospitality: {
    Icon: BedDouble,
    features: ["timeslot", "rentals", "catalog", "media", "reviews", "location", "messaging"],
    heroTint: "from-orange-500/15 via-amber-400/10 to-transparent",
    iconTint: "bg-orange-100 text-orange-600",
    customersNoun: "customers",
    modules: {
      daily: ["bookings", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  pharmacy: {
    Icon: Pill,
    features: ["catalog", "orders", "verifications", "location", "reviews", "messaging"],
    heroTint: "from-emerald-500/15 via-teal-400/10 to-transparent",
    iconTint: "bg-emerald-100 text-emerald-700",
    customersNoun: "customers",
    modules: {
      daily: ["orders", "pos", "items", "inventory", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  petCare: {
    Icon: PawPrint,
    features: ["appointments", "catalog", "team", "reviews", "location", "messaging", "media"],
    heroTint: "from-yellow-500/15 via-amber-400/10 to-transparent",
    iconTint: "bg-yellow-100 text-yellow-700",
    customersNoun: "clients",
    modules: {
      daily: ["bookings", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  professional: {
    Icon: Scale,
    features: ["appointments", "requests", "verifications", "team", "reviews", "messaging"],
    heroTint: "from-blue-500/15 via-sky-400/10 to-transparent",
    iconTint: "bg-blue-100 text-blue-600",
    customersNoun: "clients",
    modules: {
      daily: ["requests", "bookings", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY,
      store: STORE,
    },
  },
  contractors: {
    Icon: HardHat,
    features: ["requests", "portfolio", "verifications", "reviews", "location", "messaging", "media"],
    heroTint: "from-amber-500/15 via-yellow-400/10 to-transparent",
    iconTint: "bg-amber-100 text-amber-700",
    customersNoun: "clients",
    modules: {
      daily: ["requests", "items", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
  farm: {
    Icon: Sprout,
    features: ["catalog", "orders", "delivery", "reviews", "location", "media"],
    heroTint: "from-lime-500/15 via-green-400/10 to-transparent",
    iconTint: "bg-lime-100 text-lime-700",
    customersNoun: "customers",
    modules: {
      daily: ["orders", "items", "inventory", "tasks"],
      people: ["customers", "campaigns", "automations", "staff"],
      money: MONEY_WITH_SUPPLIERS,
      store: STORE,
    },
  },
};

/** Convenience: full sector config + legacy flow config in one lookup. */
export function getSector(category: CategoryKey) {
  return { ...sectorConfig[category], flow: categoryModule[category] };
}

/** The sector's default feature bundle. */
export function sectorDefaultModules(category: CategoryKey): FeatureModuleKey[] {
  return sectorConfig[category].features;
}

/** Effective enabled modules for a store: sector defaults + per-store toggles,
 *  with dependencies pulled in so the set is always internally consistent.
 *  `overrides` come from the store_modules table (added in a later phase). */
export function resolveStoreModules(
  category: CategoryKey,
  overrides?: Partial<Record<FeatureModuleKey, boolean>>,
): Set<FeatureModuleKey> {
  const base = new Set<FeatureModuleKey>(sectorDefaultModules(category));
  if (overrides) {
    for (const key of Object.keys(overrides) as FeatureModuleKey[]) {
      if (overrides[key]) base.add(key);
      else base.delete(key);
    }
  }
  return withDependencies(base);
}
