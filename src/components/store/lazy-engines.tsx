"use client";

import dynamic from "next/dynamic";

// ===== Sector transaction engines, fetched where they render =====
//
// `/store/[id]` statically imported every sector's transaction UI, so the route
// carried all of them and every visitor downloaded all of them: a bakery's
// customer paid for the hotel stay engine, the ticket picker, the class booker,
// the hourly-resource booker and the appointment panel — none of which its page
// ever draws.
//
// WHY THIS FILE IS A CLIENT MODULE. The obvious fix — calling `next/dynamic`
// directly in the server component — does nothing under Next 16 + Turbopack:
// the client-reference manifest for the route still lists every engine as a
// SYNCHRONOUS reference in the page's one chunk group (verified by reading
// `.next/server/app/**/page_client-reference-manifest.js`, where each entry
// stayed `"async": false`). A server component cannot open an async chunk
// boundary in the CLIENT graph, because it is not in that graph. The dynamic
// import has to live on the client side of the boundary, which is what this
// module is: a client module holding nothing but the import thunks, so the
// engine behind each one becomes its own async chunk.
//
// `ssr` is deliberately left at its default (true) on every engine here. Each
// one still renders on the server exactly as before, so its markup — headings,
// service names, prices, CTA labels — is still in the HTML a crawler receives.
// Only the moment the client CHUNK is fetched changes.
//
// What is NOT here, on purpose:
//   • `StoreProducts` — the cart/coupon/loyalty/zones/idempotency surface. The
//     order path is the common case (retail, food, pharmacy, farm) and it is the
//     money path; it stays a static import so nothing about it arrives late.
//   • The section components that are already server components (courses,
//     memberships, portfolio, doctors, verifications) — they ship no client JS
//     to defer.

export const ServiceRequestForm = dynamic(() =>
  import("@/components/service-request-form").then((m) => m.ServiceRequestForm),
);

export const LeadForm = dynamic(() =>
  import("@/components/lead-form").then((m) => m.LeadForm),
);

export const StaySearch = dynamic(() =>
  import("@/components/stay-search").then((m) => m.StaySearch),
);

export const EventTickets = dynamic(() =>
  import("@/components/event-tickets").then((m) => m.EventTickets),
);

export const TimeslotBooking = dynamic(() =>
  import("@/components/timeslot-booking").then((m) => m.TimeslotBooking),
);

export const ClassesBooking = dynamic(() =>
  import("@/components/classes-booking").then((m) => m.ClassesBooking),
);

export const ReservationForm = dynamic(() =>
  import("@/components/reservation-form").then((m) => m.ReservationForm),
);

export const BookingPanel = dynamic(() =>
  import("@/components/booking-panel").then((m) => m.BookingPanel),
);
