// Turning a Lebanese phone number into something wa.me will actually open.
//
// Every WhatsApp link in the app was built as `wa.me/${phone.replace(/\D/g,"")}`,
// which for a number stored the way Lebanese merchants type it — 03709064,
// 81457806, 71757701 — produces wa.me/03709064. WhatsApp cannot resolve that:
// the link needs a full international number, and every one of those buttons
// has been opening a dead page.
//
// Rules, in the order they apply:
//   already international (starts 961, long enough)  → leave alone
//   local with a trunk zero  (03709064)              → 961 + 3709064
//   local without one        (81457806)              → 961 + 81457806
//
// Returns null when there is nothing dialable, so callers can hide the button
// rather than render a link to nowhere.
const LB = "961";

export function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;

  // Already carries the country code (961 + 7 or 8 national digits).
  if (digits.startsWith(LB) && digits.length >= 10) return digits;

  // Trunk prefix: dropped before the country code, never kept.
  if (digits.startsWith("0")) return LB + digits.slice(1);

  return LB + digits;
}

/** Full wa.me URL, or null when the number cannot be dialled. */
export function waLink(
  raw: string | null | undefined,
  text?: string,
): string | null {
  const n = waNumber(raw);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
