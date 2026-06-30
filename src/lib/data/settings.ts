import { createClient } from "@/lib/supabase/server";

/** USD→LBP rate from app_settings (0 if unset/invalid → callers hide LBP). */
export async function getUsdLbpRate(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "usd_lbp_rate")
    .maybeSingle();
  const r = Number((data as { value?: string } | null)?.value);
  return Number.isFinite(r) && r > 0 ? r : 0;
}
