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
 * The same threshold, asked as a question rather than answered in class names.
 *
 * A rail hides itself; a NAVIGATION LINK has no layout to hide, so the caller
 * needs the boolean and drops the entry from its own list (MP-026). The rule
 * being one constant is the point: the reason a section is missing from the
 * footer is the reason its rail is missing from the home page, and moving the
 * bar moves both together.
 *
 * Note the difference in reach that follows from the two mechanisms:
 * railOnlyIfEnough() hides below `lg` only, because a short grid still looks
 * deliberate on a desktop. A link that leads to two results is a wasted tap at
 * every width, so this one is not breakpoint-scoped.
 */
export function hasEnough(count: number) {
  return count >= MIN_RAIL_ITEMS;
}
