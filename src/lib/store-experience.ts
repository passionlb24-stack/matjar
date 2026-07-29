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
  "realEstate",
  "automotive",
]);

// Sectors that book a date-range STAY (accommodation engine, migration 0191).
const STAY_SECTORS: ReadonlySet<CategoryKey> = new Set<CategoryKey>([
  "hospitality",
]);

// Sectors that sell event TICKETS (ticketing engine, migration 0193).
const TICKET_SECTORS: ReadonlySet<CategoryKey> = new Set<CategoryKey>([
  "events",
]);

// Sectors whose correct model is capturing a LEAD (inquiry / viewing / test
// drive / offer) — high-consideration listings, not a cart or an appointment.
// These get an on-platform lead form (CP3, migration 0190) instead of only a
// WhatsApp hand-off.
const LEAD_SECTORS: ReadonlySet<CategoryKey> = new Set<CategoryKey>([
  "realEstate",
  "automotive",
]);

/** The lead kinds a sector's inquiry form should offer (first = default). */
export function leadKinds(category: CategoryKey): string[] {
  if (category === "realEstate") return ["viewing", "contact", "offer"];
  if (category === "automotive") return ["test_drive", "contact", "offer"];
  return ["contact"];
}

export type StoreExperience = {
  status: SectorStatus;
  itemSurface: ItemSurface;
  /** Appointment booking engine (BookingPanel) should surface. */
  showBooking: boolean;
  /** Service-request / quote form should surface. */
  showServiceRequest: boolean;
  /** Lead / inquiry capture form should surface (real estate, automotive). */
  showLeadForm: boolean;
  /** Date-range accommodation search + booking should surface (hospitality). */
  showStay: boolean;
  /** Event ticket purchase should surface (events). */
  showTickets: boolean;
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

  if (STAY_SECTORS.has(category)) {
    return {
      status: "active",
      itemSurface: "catalog",
      showBooking: false,
      showServiceRequest: false,
      showLeadForm: false,
      showStay: true,
      showTickets: false,
      allowResourceBooking: false, // uses the stay engine, not hourly slots
      directoryOnly: false,
    };
  }

  if (TICKET_SECTORS.has(category)) {
    return {
      status: "active",
      itemSurface: "catalog",
      showBooking: false,
      showServiceRequest: false,
      showLeadForm: false,
      showStay: false,
      showTickets: true,
      allowResourceBooking: false, // ticketing, not hourly slots
      directoryOnly: false,
    };
  }

  if (DIRECTORY_ONLY_SECTORS.has(category)) {
    return {
      status: "directory_only",
      itemSurface: "catalog",
      showBooking: false,
      // Lead sectors (automotive/realEstate) use the LEAD form as their single
      // inquiry channel — don't also show the generic service-request form (that
      // split car inquiries across two merchant inboxes). Non-lead directory-only
      // sectors may still surface `requests` as their inquiry channel.
      showServiceRequest: hasRequests && !LEAD_SECTORS.has(category),
      showLeadForm: LEAD_SECTORS.has(category),
      showStay: false,
      showTickets: false,
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
    showLeadForm: false,
    showStay: false,
    showTickets: false,
    allowResourceBooking: true,
    directoryOnly: false,
  };
}
