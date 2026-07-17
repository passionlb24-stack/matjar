import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * The store's effective plan ('free' | 'pro' | null). Used to gate Pro-only OS
 * modules. A store on an active 14-day free trial (trial_ends_at in the future)
 * counts as 'pro' so every Pro module unlocks during the trial.
 */
export async function getStorePlan(storeId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("plan, trial_ends_at")
    .eq("id", storeId)
    .maybeSingle();
  const store = data as { plan?: string; trial_ends_at?: string | null } | null;
  if (!store) return null;
  const onTrial =
    store.trial_ends_at != null && new Date(store.trial_ends_at) > new Date();
  if (store.plan === "pro" || onTrial) return "pro";
  return store.plan ?? null;
}
