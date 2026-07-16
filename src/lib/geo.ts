// Great-circle distance in km between two lat/lng points (Haversine). Pure —
// used client-side to sort stores by distance from the buyer.
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371; // Earth radius, km
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Distance in km from the buyer to the CLOSEST branch of a store. Multi-branch
// stores carry a `locations` list; "near me" must rank by the nearest branch,
// not the primary pin. Falls back to the store's own lat/lng when no located
// branch exists, and undefined when the store has no coordinates at all.
// Typed structurally so this file stays free of catalog imports.
export function nearestDistance(
  store: {
    lat?: number | null;
    lng?: number | null;
    locations?: { lat: number | null; lng: number | null }[];
  },
  userLat: number,
  userLng: number,
): number | undefined {
  let best: number | undefined;
  for (const loc of store.locations ?? []) {
    if (loc.lat == null || loc.lng == null) continue;
    const d = distanceKm(userLat, userLng, loc.lat, loc.lng);
    if (best == null || d < best) best = d;
  }
  if (best != null) return best;
  if (store.lat != null && store.lng != null) {
    return distanceKm(userLat, userLng, store.lat, store.lng);
  }
  return undefined;
}
