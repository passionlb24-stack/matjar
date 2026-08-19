import type { Dictionary } from "@/i18n/get-dictionary";

// One place that turns a raw database value into words a person can read.
//
// The bug this exists to kill (MP-020): the customer activity screen was handed
// an EMPTY label map for leads, so an Arabic-speaking customer saw the literal
// Postgres enum — `negotiating`, `won` — sitting in a pill between two properly
// translated Arabic rows. The wording already existed in the dictionary; the
// screen simply never reached for it.
//
// That is not a one-screen mistake, it is a shape. Every caller used to hold its
// own `dict.something.status as Record<string, string>` cast, and a cast is
// exactly the thing that lets `{}` through without a murmur. Routing every
// lookup through one table means "which dictionary block describes leads?" has a
// single answer that TypeScript checks, instead of eighteen answers spread
// across pages that can each be wrong on their own.
//
// Deliberately NOT a merged status vocabulary. `pending` on a food order and
// `pending` on a tradesman's job are different promises, and lib/data/activity.ts
// keeps them apart on purpose. This maps DOMAIN + value → words; it never
// decides that two domains mean the same thing.

/**
 * A domain is one (table.column) whose values a human reads.
 *
 * Every entry names the migration its values come from, because the only way to
 * know this file is still complete is to be able to go and check.
 */
export type LabelDomain =
  /** orders.status — `order_status` enum, 0006 (+ nothing since). */
  | "order"
  /** bookings.status — `booking_status` enum, 0010 + `no_show` from 0177. */
  | "booking"
  /** craft_requests.status — check constraint, 0239. */
  | "craftRequest"
  /** service_requests.status — `service_request_status`, 0083 + `countered` 0207. */
  | "serviceRequest"
  /** stay_bookings.status — `stay_status` enum, 0191. */
  | "stayBooking"
  /** leads.status — `lead_status` enum, 0190. */
  | "lead"
  /** leads.kind — `lead_kind` enum, 0190. */
  | "leadKind"
  /** stores.status — `store_status` enum, 0003. */
  | "storeStatus"
  /** profiles.role — `platform_role` enum, 0001. */
  | "platformRole"
  /** listings.status — check constraint, 0036 + `expired` from 0039. */
  | "marketListing"
  /** store_campaigns.audience — validated in send_store_campaign(), 0164. */
  | "campaignAudience"
  /** automations.trigger — fixed vocabulary, 0117 + 0118 + 0120. */
  | "automationTrigger"
  /** store_customers.status — check constraint, 0068. */
  | "crmCustomer"
  /** job_postings.job_type — free text, values fixed by the posting form. */
  | "jobType"
  /** gigs.category — free text, values fixed by the gig form. */
  | "freelanceCategory"
  /** wholesale_listings.category — free text, values fixed by the listing form. */
  | "wholesaleCategory";

/**
 * Where each domain's wording lives in the dictionary.
 *
 * Functions rather than dotted-string paths so a renamed dictionary block breaks
 * the build here instead of returning `undefined` to a customer at runtime.
 */
const BLOCKS: Record<LabelDomain, (d: Dictionary) => Record<string, string>> = {
  order: (d) => d.orders.status,
  booking: (d) => d.booking.status,
  craftRequest: (d) => d.crafts.reqStatuses,
  serviceRequest: (d) => d.os.requests.status,
  stayBooking: (d) => d.os.stays.status,
  // Leads keep ONE set of words for merchant and customer alike. The tracker
  // suggested a second `activity.leadStatus` block, but two copies of "تواصلت"
  // is two things to keep in step, and the pair drifting is how the merchant
  // and the customer end up reading different words for the same row.
  lead: (d) => d.os.leads.status,
  leadKind: (d) => d.os.leads.kinds,
  storeStatus: (d) => d.admin.storesAdmin.statusLabels,
  platformRole: (d) => d.admin.usersAdmin.roles,
  marketListing: (d) => d.admin.market.statusLabels,
  campaignAudience: (d) => d.os.campaigns.audiences,
  automationTrigger: (d) => d.os.automations.triggers,
  crmCustomer: (d) => d.os.crm.status,
  jobType: (d) => d.jobs.types,
  freelanceCategory: (d) => d.freelance.categories,
  wholesaleCategory: (d) => d.wholesale.categories,
};

/**
 * Every label for a domain, as a plain object.
 *
 * Use this for the props of client components that already take a map (a
 * `<select>` of statuses, a list that labels many rows). Passing the map keeps
 * the dictionary on the server, which is the whole point of lib/dict-slice.ts.
 */
export function labelMap(
  dict: Dictionary,
  domain: LabelDomain,
): Record<string, string> {
  return BLOCKS[domain](dict) as unknown as Record<string, string>;
}

/**
 * The words for one raw value.
 *
 * An unrecognised value renders AS ITSELF, on purpose. The alternatives are
 * worse in both directions: a blank cell is a mystery the merchant cannot even
 * describe to support, and a generic "غير معروف" quietly claims the row has no
 * status when it plainly has one. A merchant who phones in to say "it says
 * pending_v2" has just filed a precise bug report, and nothing was hidden from
 * them in the meantime. It never throws — a status nobody anticipated must not
 * be able to take down the page that displays it.
 *
 * A nullish or blank value returns "" because there is nothing to label; every
 * caller guards that case (`{x && <Badge>…</Badge>}`) rather than printing an
 * empty pill.
 */
export function labelFor(
  dict: Dictionary,
  domain: LabelDomain,
  value: string | null | undefined,
): string {
  if (!value) return "";
  return labelMap(dict, domain)[value] ?? value;
}
