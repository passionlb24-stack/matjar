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
