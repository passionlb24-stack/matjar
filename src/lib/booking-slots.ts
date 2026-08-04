// Which (resource, day) the loaded slot list belongs to.
//
// The booking panel used to raise a `loadingSlots` flag and clear the picked
// slot inside the fetch effect. Between the day changing and the effect running,
// there was a frame holding the OLD day's slots with the OLD pick still
// selected — long enough to submit a booking against a day the merchant had
// already navigated away from.
//
// Tagging the loaded data with the key it describes makes that unrepresentable:
// slots that don't match the current key are, by definition, not loaded yet.

/**
 * `done` is part of the key on purpose: completing a booking has to re-fetch the
 * same day, and without it the key would be unchanged and the list stale.
 *
 * @returns null when there is nothing to load yet (no resource or no date).
 */
export function slotsKey(
  resourceId: string | null | undefined,
  date: string | null | undefined,
  done: boolean,
): string | null {
  if (!resourceId || !date) return null;
  return `${resourceId}|${date}|${done}`;
}

/** Loading is "what we hold isn't what's selected", not a separate flag. */
export function slotsLoading(
  currentKey: string | null,
  loadedKey: string | null,
): boolean {
  return currentKey !== null && loadedKey !== currentKey;
}
