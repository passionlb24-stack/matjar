"use server";

import { revalidateTag } from "next/cache";

// Server actions client components call after a mutation, so the cross-request
// caches (see src/lib/data/*) refresh immediately instead of waiting out their
// TTL. Cheap and safe — revalidateTag just marks the tag stale.
//
// Next 16's revalidateTag type gained a required Cache-Components profile arg,
// but for `unstable_cache` tags the single-arg form is still the documented
// on-demand invalidator (see the caching-without-cache-components guide). Call
// it through a one-arg-typed wrapper so we hit that runtime behaviour.
const bustTag = revalidateTag as unknown as (tag: string) => void;

/** Bust the cached active-store listing (store created / edited / approved). */
export async function revalidateStores() {
  bustTag("stores");
}

/** Bust the cached USD→LBP rate (admin changed it). */
export async function revalidateRate() {
  bustTag("usd_lbp_rate");
}

/** Bust a product's cached public view (product created / edited / deleted). */
export async function revalidateProduct(id?: string) {
  bustTag("products");
  if (id) bustTag(`product:${id}`);
}

/** Bust a Sunday-Market listing's cached public view (created / edited / moderated). */
export async function revalidateListing(id?: string) {
  bustTag("listings");
  if (id) bustTag(`listing:${id}`);
}
