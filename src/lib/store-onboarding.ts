import type { CategoryKey } from "@/lib/catalog";
import type { FeatureModuleKey } from "@/lib/modules-catalog";

// The first five minutes: what a new merchant is asked, and how they are told
// where they stand afterwards. Two small decisions, both pure, both measured
// against the live platform rather than guessed at:
//
//   • 16 of 36 stores have zero products and 21 have no cover or no
//     description. The create form asks eight questions, only two of which it
//     enforces, and then drops the merchant on a store LIST — so the eight
//     answers buy nothing and the ninth thing (the first product) never
//     happens. Fewer, better-aimed questions is the fix; a longer form is not.
//
//   • A merchant cannot tell when their shop became real. `stores.status` is
//     admin-controlled and always will be, but "I finished" and "someone is
//     looking at it" and "it is live" are three different states and the OS
//     home rendered the same card for all three.

// ---------------------------------------------------------------------------
// Sector-aware intake
// ---------------------------------------------------------------------------

/** A question the create form may ask, beyond the four it always asks (business
 *  type, name, custom link, WhatsApp). Every key maps to a real `stores`
 *  column — nothing here is asked for that the database cannot keep. */
export type IntakeFieldKey =
  /** `region` — the coarse filter every discovery surface sorts on. */
  | "region"
  /** `area` — the free-text address under the pin. */
  | "area"
  /** `accepts_delivery` + `accepts_pickup`, one control. */
  | "fulfillment"
  /** `specialties` — the first block a clinic's public page renders. */
  | "specialties"
  /** `description` — a publish blocker, so it is asked while the merchant is
   *  still in the mood to type. */
  | "description";

/** What to ask THIS sector, in order.
 *
 *  Driven off the store's resolved feature modules, not off a table of
 *  seventeen sectors: a question is asked only where the module that consumes
 *  the answer is switched on. A tutor with no `location` module is not
 *  interrogated about which street they are on, and a clinic is not asked
 *  whether it delivers.
 *
 *  `specialties` is the one explicit sector case, and deliberately so: it is a
 *  column with a single consumer (the healthcare profile block) and no module
 *  key of its own — the same gate `store-settings-form.tsx` already uses. */
export function storeIntakeFields(
  category: CategoryKey,
  modules: Set<FeatureModuleKey>,
): IntakeFieldKey[] {
  const out: IntakeFieldKey[] = [];
  if (modules.has("location")) out.push("region", "area");
  if (modules.has("delivery")) out.push("fulfillment");
  if (category === "healthcare") out.push("specialties");
  // Last, and always: it is the one required item a merchant can finish in the
  // same sitting, and the checklist has to ask for it anyway if they skip it.
  out.push("description");
  return out;
}

// ---------------------------------------------------------------------------
// Where the merchant stands
// ---------------------------------------------------------------------------

/** `setup`   — required items still missing; the store is not ready.
 *  `review`  — the merchant has finished; the platform has not approved yet.
 *  `live`    — the public page exists.
 *  `blocked` — suspended or rejected. Nothing about readiness is worth saying
 *              here: the reason the page is down is not a missing cover photo,
 *              and the store's own suspension notice owns this case. */
export type PublishStage = "setup" | "review" | "live" | "blocked";

/** Which of the four a merchant is in.
 *
 *  This grants nobody a new power. `stores.status` moves only through the admin
 *  flow and its guards; `readyToPublish` comes from the completeness module and
 *  describes the merchant's own work. The two are simply not the same question,
 *  and answering only one of them is why "is my shop open?" had no answer.
 *
 *  Status wins over readiness in both directions. A live store whose catalogue
 *  is thin is still live — telling it otherwise would be a lie the customer can
 *  disprove by opening the page — and a suspended store is not "nearly ready". */
export function publishStage(
  status: string,
  readyToPublish: boolean,
): PublishStage {
  if (status === "active") return "live";
  if (status === "suspended" || status === "rejected") return "blocked";
  return readyToPublish ? "review" : "setup";
}

/** A store nobody has started yet: not one publish blocker cleared.
 *
 *  Used to decide whether to show the whole checklist or a single instruction.
 *  Eight things asked of someone who has done none of them is the state in
 *  which people close the tab; one thing is a state in which they act. Measured
 *  against required items only, so a merchant who picked a brand colour first
 *  is still — correctly — treated as not having started. */
export function isFirstRun(
  items: { required: boolean; done: boolean }[],
): boolean {
  const required = items.filter((i) => i.required);
  return required.length > 0 && required.every((i) => !i.done);
}
