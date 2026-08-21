// Which optional questions the service-request form asks, per store.
//
// Two rules decide this, in order:
//   1. What the sector actually needs. A plumber's job is decided by a photo
//      and how urgent it is; a consultancy's by a budget and a start date.
//      Asking a plumber's customer for a budget range, or a law firm's client
//      for a photo of the problem, is the fifteen-field form that gets
//      abandoned.
//   2. What the merchant said. `stores.request_intake` (0297) overrides any
//      key; an absent key keeps the sector default. A shop that does not want
//      to ask for a budget turns it off and it is gone.
//
// Nothing here is ever required — every field these flags control is optional
// on the form and nullable in the database. The trade can always start without
// them; they exist to remove the callback, not to gate the request.

export const INTAKE_KEYS = ["photos", "urgency", "budget", "timeline"] as const;
export type IntakeKey = (typeof INTAKE_KEYS)[number];
export type IntakeConfig = Record<IntakeKey, boolean>;

// Keys are business_types.slug, which IS the CategoryKey (store-view.ts:248).
const SECTOR_DEFAULTS: Record<string, IntakeConfig> = {
  // Field service and site work: the photo and the urgency are the callback.
  services: { photos: true, urgency: true, budget: false, timeline: false },
  contractors: { photos: true, urgency: true, budget: false, timeline: false },
  // Professional services: a brief, not a call-out. Budget and start date are
  // what a consultant needs to decide whether to reply at all; a photo of the
  // problem usually is not a thing, so it starts off and can be turned on by
  // the architect or the surveyor who does want one.
  professional: { photos: false, urgency: false, budget: true, timeline: true },
};

// Only the three sectors above put this form on their storefront today
// (sectors.ts profile order), but the form is not gated on that, so anything
// else gets the call-out shape rather than nothing.
const FALLBACK: IntakeConfig = {
  photos: true,
  urgency: true,
  budget: false,
  timeline: false,
};

export function resolveIntake(
  category: string | null | undefined,
  overrides: unknown,
): IntakeConfig {
  const base = (category && SECTOR_DEFAULTS[category]) || FALLBACK;
  const out: IntakeConfig = { ...base };
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const k of INTAKE_KEYS) {
      const v = (overrides as Record<string, unknown>)[k];
      if (typeof v === "boolean") out[k] = v;
    }
  }
  return out;
}
