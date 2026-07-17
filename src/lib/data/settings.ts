import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public-client";

// Cross-request cache: the USD→LBP rate is read on every page (the header shows
// it) but changes rarely, and it's the same for everyone. unstable_cache serves
// it from the data cache for up to 5 minutes instead of hitting Postgres on
// every request platform-wide. Uses the cookie-less public client because
// unstable_cache can't run code that reads request cookies. Tagged so an admin
// rate change can bust it immediately (revalidateTag("usd_lbp_rate")).
const cachedRate = unstable_cache(
  async (): Promise<number> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "usd_lbp_rate")
      .maybeSingle();
    const r = Number((data as { value?: string } | null)?.value);
    return Number.isFinite(r) && r > 0 ? r : 0;
  },
  ["usd_lbp_rate"],
  { revalidate: 300, tags: ["usd_lbp_rate"] },
);

/**
 * USD→LBP rate from app_settings (0 if unset/invalid → callers hide LBP).
 * React `cache()` dedupes the ~11 call sites within one render; unstable_cache
 * dedupes across requests (5-min TTL, same value for everyone).
 */
export const getUsdLbpRate = cache(async function getUsdLbpRate(): Promise<number> {
  return cachedRate();
});
