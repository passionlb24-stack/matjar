"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Fire-and-forget view count when the listing page mounts.
export function ListingViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    createClient()
      .rpc("increment_listing_view", { p_id: listingId })
      .then(() => {});
  }, [listingId]);
  return null;
}
