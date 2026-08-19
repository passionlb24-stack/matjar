import type { ComponentProps } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Badge } from "@/components/ui/badge";

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

/**
 * The Badge variants, taken FROM the badge so the two cannot drift. A variant
 * renamed in ui/badge.tsx breaks this line rather than silently painting every
 * pill neutral.
 */
export type StatusTone = NonNullable<ComponentProps<typeof Badge>["variant"]>;

/**
 * How a status LOOKS, alongside the words it reads as (MP-022).
 *
 * The customer activity screen is the only place in Matjar that puts four
 * status vocabularies in one scrollable column, and it painted all of them the
 * same neutral grey — so a cancelled booking, a finished order and an order on
 * the van were one indistinguishable shade, and the pill did no work at all.
 *
 * Tone is deliberately assigned by PHASE, not per value, and the phases are the
 * same four in every domain, because the whole point is a mixed list that can
 * be scanned in one pass:
 *
 *   warning  the ball is with the merchant/tradesman — nothing has been said yet
 *   info     under way: accepted, being prepared, being discussed
 *   primary  the customer's turn, right now — ready to collect, on its way
 *   success  ended well
 *   danger   ended by a refusal
 *   neutral  ended by nobody — cancelled, dropped
 *
 * Two values inside one phase share a tone on purpose. The tone answers "how
 * far along, and is it mine?"; the LABEL beside it answers "which step". A
 * palette with a distinct colour per value would be eight colours nobody can
 * hold in their head.
 *
 * Domains not listed here have no customer-facing pill; they fall through to
 * neutral rather than forcing a colour onto vocabulary nobody has looked at.
 */
const TONES: Partial<Record<LabelDomain, Record<string, StatusTone>>> = {
  // orders.status — 0006.
  order: {
    pending: "warning",
    accepted: "info",
    preparing: "info",
    ready: "primary",
    out_for_delivery: "primary",
    completed: "success",
    cancelled: "neutral",
    rejected: "danger",
  },
  // bookings.status — 0010 + 0177. `no_show` is a warning, not a danger: it is
  // the one terminal state the customer can still ring up and fix.
  booking: {
    pending: "warning",
    accepted: "info",
    scheduled: "info",
    completed: "success",
    cancelled: "neutral",
    rejected: "danger",
    no_show: "warning",
  },
  // craft_requests.status — 0239.
  craftRequest: {
    pending: "warning",
    accepted: "info",
    in_progress: "info",
    completed: "success",
    declined: "danger",
    cancelled: "neutral",
  },
  // leads.status — 0190. Read from the CUSTOMER's side, which is the side that
  // sees this screen: `won` is their inquiry having turned into something,
  // `lost` is it having quietly ended — neither is a verdict on them.
  lead: {
    new: "warning",
    contacted: "info",
    scheduled: "info",
    negotiating: "info",
    won: "success",
    lost: "neutral",
  },
};

/**
 * The tone for one raw value.
 *
 * An unrecognised value is `neutral`, never a throw and never a guess — same
 * contract as labelFor(): a status nobody anticipated must not be able to take
 * down the screen that shows it, and grey is the one tone that claims nothing.
 */
export function statusTone(
  domain: LabelDomain,
  value: string | null | undefined,
): StatusTone {
  if (!value) return "neutral";
  return TONES[domain]?.[value] ?? "neutral";
}

/**
 * Which domain each row of the customer activity screen speaks.
 *
 * The screen calls its four row types `order | booking | craft | lead`; three
 * of those are also domain names and one (`craft` → `craftRequest`) is not,
 * which is exactly the sort of near-miss that gets typed out twice and then
 * drifts. Stated once here, and used by both the server page that resolves the
 * WORDS and the client list that resolves the COLOUR, so the two can never
 * disagree about which vocabulary a row belongs to.
 *
 * Not typed against `ActivityKind` here — lib/data/activity.ts is `server-only`
 * and this table is read in the browser. The page assigns it INTO a
 * `Record<ActivityKind, …>`, which is where TypeScript checks the two agree.
 */
export const ACTIVITY_DOMAINS = {
  order: "order",
  booking: "booking",
  craft: "craftRequest",
  lead: "lead",
} as const satisfies Record<string, LabelDomain>;
