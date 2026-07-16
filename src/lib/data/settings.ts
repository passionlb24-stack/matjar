import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * USD→LBP rate from app_settings (0 if unset/invalid → callers hide LBP).
 * Wrapped in React `cache()` so the ~11 call sites across a single render
 * (layout + homepage + product/store + components) share ONE query per request
 * instead of re-hitting the DB each time.
 */
export const getUsdLbpRate = cache(async function getUsdLbpRate(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "usd_lbp_rate")
    .maybeSingle();
  const r = Number((data as { value?: string } | null)?.value);
  return Number.isFinite(r) && r > 0 ? r : 0;
});
