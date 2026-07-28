import type { CategoryKey } from "./catalog";
import type { FeatureModuleKey } from "./modules-catalog";
import { categoryModule } from "./modules";

// ===== Store Experience Resolver =====
// The single source of truth for WHAT transaction surface a storefront shows.
// Historically the public store page decided this from hardcoded slug lists
// (`bookingCategories = {services, healthcare, realEstate}`) that disagreed with
// the sector registry — so sectors that declared an `appointments`/`requests`
// module never surfaced it, and sectors whose correct engine does not exist yet
// (hotels, real estate, car sales, event tickets) exposed a wrong flow (a hotel
// booked by the hour, a car sold via cart). This resolver derives the surface
// from the ENABLED MODULES + an explicit sector operational status, never from
// raw slugs, so the two can never drift again.
//
// It is intentionally a pure function (no I/O) so it is unit-testable and can be
// reused by the public store page, the product detail page, and future surfaces.

export type SectorStatus = "active" | "directory_only";

/** What the store's main items list renders as. */
export type ItemSurface =
  | "order" // cart → order (retail/food/pharmacy/farm)
  | "appointment" // BookingPanel appointment engine (clinic/salon/vet/pro)
  | "catalog"; // non-transactional list + contact (directory-only / service listings)

// Sectors whose correct transaction engine is NOT built yet. Until it is, they
// run in directory-only mode: browse + contact, never a wrong transaction.
// - hospitality: needs a date-range STAY engine (currently only hourly slots).
// - realEstate: needs a LEAD/viewing flow (currently a clinic-style appointment).
// - automotive: needs LISTING + LEAD (currently sold via cart + COD).
// - events: needs TICKETING / venue date booking (currently hourly slots).
// Removing a sector from this set is a deliberate go-live decision made once its
// engine ships (see the vertical audit, files 06/12/13/15).
const DIRECTORY_ONLY_SECTORS: ReadonlySet<CategoryKey> = new Set<CategoryKey>([
  "hospitality",
  "realEstate",
  "automotive",
  "events",
]);

export type StoreExperience = {
  status: SectorStatus;
  itemSurface: ItemSurface;
  /** Appointment booking engine (BookingPanel) should surface. */
  showBooking: boolean;
  /** Service-request / quote form should surface. */
  showServiceRequest: boolean;
  /** Resource (hourly) / class / reservation booking may surface (still gated
   *  on seeded rows by the caller). False in directory-only mode so a hotel or
   *  event hall never exposes an hourly booking. */
  allowResourceBooking: boolean;
  /** Directory-only: show a contact CTA instead of a transaction. */
  directoryOnly: boolean;
};

/** Whether a sector is held in directory-only mode (engine not ready). */
export function isDirectoryOnlySector(category: CategoryKey): boolean {
  return DIRECTORY_ONLY_SECTORS.has(category);
}

/** Whether the product detail page should show the add-to-cart order box.
 *  True only for commerce sectors that are NOT directory-only. */
export function isOrderSurface(category: CategoryKey): boolean {
  return (
    (categoryModule[category]?.kind ?? "commerce") === "commerce" &&
    !DIRECTORY_ONLY_SECTORS.has(category)
  );
}

export function resolveStoreExperience(args: {
  category: CategoryKey;
  enabledModules: ReadonlySet<FeatureModuleKey>;
}): StoreExperience {
  const { category, enabledModules } = args;
  const kind = categoryModule[category]?.kind ?? "commerce";
  const hasAppointments = enabledModules.has("appointments");
  const hasRequests = enabledModules.has("requests");

  if (DIRECTORY_ONLY_SECTORS.has(category)) {
    return {
      status: "directory_only",
      itemSurface: "catalog",
      showBooking: false,
      // A directory-only sector may still declare `requests` (e.g. automotive)
      // — surface it as an interim on-platform inquiry/lead capture channel
      // rather than losing the lead to WhatsApp. No wrong booking/cart.
      showServiceRequest: hasRequests,
      allowResourceBooking: false,
      directoryOnly: true,
    };
  }

  // Active: derive the surface from the enabled modules, not the slug.
  const showBooking = hasAppointments;
  const itemSurface: ItemSurface = showBooking
    ? "appointment"
    : kind === "commerce"
      ? "order"
      : "catalog";

  return {
    status: "active",
    itemSurface,
    showBooking,
    showServiceRequest: hasRequests,
    allowResourceBooking: true,
    directoryOnly: false,
  };
}
