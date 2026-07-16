import "server-only";
import { createClient } from "@/lib/supabase/server";

/** The store's plan ('free' | 'pro' | null). Used to gate Pro-only OS modules. */
export async function getStorePlan(storeId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("plan")
    .eq("id", storeId)
    .maybeSingle();
  return (data as { plan?: string } | null)?.plan ?? null;
}
