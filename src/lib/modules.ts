import type { CategoryKey } from "./catalog";

// Each business type drives a different merchant experience: commerce types run
// an order flow (cart → orders), booking types run an appointment flow
// (services → bookings). `itemsKey` maps to dict.store.* (the noun for the
// catalog: menu / products / services / listings) and `addKey` maps to
// dict.merchant.products.* (the "add" button label). `simplifiedItem` hides
// stock/variants/add-ons for one-off listings and services.
export type StoreModuleKind = "commerce" | "booking";

export type StoreModule = {
  kind: StoreModuleKind;
  itemsKey: "menu" | "products" | "services" | "listings";
  addKey: "add" | "addMenuItem" | "addService" | "addListing";
  simplifiedItem: boolean;
};

export const categoryModule: Record<CategoryKey, StoreModule> = {
  food: { kind: "commerce", itemsKey: "menu", addKey: "addMenuItem", simplifiedItem: false },
  retail: { kind: "commerce", itemsKey: "products", addKey: "add", simplifiedItem: false },
  services: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  healthcare: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  realEstate: { kind: "booking", itemsKey: "listings", addKey: "addListing", simplifiedItem: true },
  automotive: { kind: "commerce", itemsKey: "listings", addKey: "addListing", simplifiedItem: true },
  beauty: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  fitness: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  sportsCourts: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  education: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  events: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  hospitality: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  pharmacy: { kind: "commerce", itemsKey: "products", addKey: "add", simplifiedItem: false },
  petCare: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  professional: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  contractors: { kind: "booking", itemsKey: "services", addKey: "addService", simplifiedItem: true },
  farm: { kind: "commerce", itemsKey: "products", addKey: "add", simplifiedItem: false },
};
