import { waLink } from "@/lib/phone";

// The one place Matjar's own contact details live.
//
// Until now the contact page linked wa.me/9610000000 — a placeholder that a
// customer could actually tap, and reach nothing. A support channel that leads
// nowhere is worse than none: the person who tried it has already decided to
// ask for help, and silence at that moment reads as the platform being dead.
//
// One constant, imported everywhere a contact affordance exists, so the day the
// number changes it changes once. The raw local form is stored and waLink()
// normalises it to international, same as every merchant number on the site.
export const SUPPORT_WHATSAPP = "71793516";

/** wa.me link for the platform's own support line, optionally with a prefilled
 *  message so the team can tell which page the person came from. */
export function supportWaLink(text?: string): string {
  // waLink returns null only for garbage input; the constant above is known
  // good, so the fallback is unreachable in practice but keeps the type honest.
  return waLink(SUPPORT_WHATSAPP, text) ?? `https://wa.me/961${SUPPORT_WHATSAPP}`;
}
