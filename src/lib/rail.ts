// Phone rails have a minimum viable width.
//
// A horizontal rail sells "there is more here" — the cut-off card at the edge
// is the whole promise. One or two cards make that promise and break it in the
// same frame, so the row reads as a loading bug rather than a short list. Below
// three real items the section is dropped on phones only; desktop keeps its
// grid, where two cards in a four-column row still look deliberate.
export const MIN_RAIL_ITEMS = 3;

// Returns the classes that keep a too-thin section off phones without touching
// the desktop layout. Callers pass the count of REAL items they will render.
export function railOnlyIfEnough(count: number) {
  return count < MIN_RAIL_ITEMS ? "hidden lg:block" : "";
}

/**
 * A navigation link needs only to not be a dead end.
 *
 * This used to reuse MIN_RAIL_ITEMS, and that was a category error I made:
 * three is a *visual* minimum for a horizontal scroller, and a nav link has no
 * scroller. The consequence was that "وظائف" disappeared from the header
 * because the platform had two job postings instead of three — a section with
 * real content in it, hidden from customers and from the owner, who found out
 * by noticing the gap.
 *
 * One is the honest bar. The gate exists so a customer does not tap through to
 * an empty page; two results is a short list, not a dead end. Zero still hides,
 * which is what it was for: crafts, wholesale and delivery have nothing behind
 * them at all.
 *
 * The two constants moving independently is now the point, not a regression of
 * the old "one rule" comment: a rail hides on phones only, because a two-card
 * grid still reads as deliberate on a desktop, whereas a link that leads
 * nowhere is wrong at every width.
 */
export const MIN_NAV_ITEMS = 1;

export function hasEnough(count: number) {
  return count >= MIN_NAV_ITEMS;
}
